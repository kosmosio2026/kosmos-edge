#!/usr/bin/env python3

from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_MANIFEST_KEYS = {
    "APP_PROFILE",
    "PROFILE_LABEL",
    "API_PORT",
    "WEB_PORT",
    "DATABASE_NAME",
    "API_DIST_DIR",
    "WEB_DIST_DIR",
    "CLOUD_SYNC_PULL_ENABLED",
    "CLOUD_SYNC_PUSH_ENABLED",
    "TENANT_MANAGEMENT_ENABLED",
    "TENANT_BILLING_ENABLED",
    "DISCOUNT_MANAGEMENT_ENABLED",
    "INFRASTRUCTURE_CONTROL_ENABLED",
}

VALID_PROFILES = {
    "cloud",
    "edge",
    "edge-standalone",
    "demo",
    "development",
}

KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def parse_env_file(path: Path):
    values = {}
    duplicates = []
    invalid_lines = []

    for line_number, raw_line in enumerate(
        path.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        line = raw_line.strip()

        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            invalid_lines.append((line_number, raw_line))
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not KEY_PATTERN.fullmatch(key):
            invalid_lines.append((line_number, raw_line))
            continue

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        if key in values:
            duplicates.append(key)

        values[key] = value

    return values, duplicates, invalid_lines


def parse_bool(value: str):
    normalized = value.strip().lower()

    if normalized == "true":
        return True

    if normalized == "false":
        return False

    return None


def database_name_from_url(value: str):
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None

    path = unquote(parsed.path).lstrip("/")

    if not path:
        return None

    return path.split("/", 1)[0]


def url_port(value: str):
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return None

    if port is not None:
        return port

    if parsed.scheme == "http":
        return 80

    if parsed.scheme == "https":
        return 443

    return None


def main():
    if len(sys.argv) != 2:
        print(
            "USAGE=python3 deploy/scripts/"
            "profile-validate.py <profile>"
        )
        return 2

    profile = sys.argv[1].strip()

    if profile not in VALID_PROFILES:
        print(f"INVALID_PROFILE={profile}")
        print(
            "ALLOWED_PROFILES="
            + ",".join(sorted(VALID_PROFILES))
        )
        return 2

    errors = []
    warnings = []

    manifest_path = (
        ROOT
        / "deploy"
        / "profiles"
        / profile
        / "manifest.env"
    )
    api_env_path = ROOT / "apps" / "api" / f".env.{profile}"
    web_env_path = ROOT / "apps" / "web" / f".env.{profile}"

    print(f"PROFILE={profile}")

    if not manifest_path.exists():
        print(f"ERROR=MISSING_MANIFEST:{manifest_path}")
        return 1

    manifest, duplicates, invalid_lines = parse_env_file(
        manifest_path
    )

    for key in sorted(set(duplicates)):
        errors.append(
            f"MANIFEST_DUPLICATE_KEY:{key}"
        )

    for line_number, raw_line in invalid_lines:
        errors.append(
            f"MANIFEST_INVALID_LINE:"
            f"{line_number}:{raw_line}"
        )

    missing_manifest_keys = sorted(
        REQUIRED_MANIFEST_KEYS - set(manifest)
    )

    for key in missing_manifest_keys:
        errors.append(f"MANIFEST_MISSING_KEY:{key}")

    if manifest.get("APP_PROFILE") != profile:
        errors.append(
            "MANIFEST_PROFILE_MISMATCH:"
            f"{manifest.get('APP_PROFILE')}!={profile}"
        )

    try:
        expected_api_port = int(manifest["API_PORT"])
        expected_web_port = int(manifest["WEB_PORT"])
    except (KeyError, ValueError):
        expected_api_port = None
        expected_web_port = None
        errors.append("MANIFEST_INVALID_PORT")

    expected_database = manifest.get("DATABASE_NAME")
    expected_web_dist = manifest.get("WEB_DIST_DIR")

    env_files = {
        "API": api_env_path,
        "WEB": web_env_path,
    }

    parsed_envs = {}

    for role, path in env_files.items():
        if not path.exists():
            errors.append(f"{role}_ENV_MISSING:{path}")
            continue

        values, duplicate_keys, invalid = parse_env_file(path)
        parsed_envs[role] = values

        for key in sorted(set(duplicate_keys)):
            errors.append(
                f"{role}_ENV_DUPLICATE_KEY:{key}"
            )

        for line_number, raw_line in invalid:
            errors.append(
                f"{role}_ENV_INVALID_LINE:"
                f"{line_number}:{raw_line}"
            )

        if "APP_MODE" in values:
            errors.append(
                f"{role}_ENV_LEGACY_APP_MODE_PRESENT"
            )

    api_env = parsed_envs.get("API")
    web_env = parsed_envs.get("WEB")

    if api_env is not None:
        actual_profile = api_env.get("APP_PROFILE")

        if actual_profile != profile:
            errors.append(
                "API_ENV_PROFILE_MISMATCH:"
                f"{actual_profile}!={profile}"
            )

        actual_api_port = api_env.get("PORT")

        if actual_api_port is None:
            errors.append("API_ENV_MISSING_KEY:PORT")
        elif expected_api_port is not None:
            try:
                if int(actual_api_port) != expected_api_port:
                    errors.append(
                        "API_PORT_MISMATCH:"
                        f"{actual_api_port}!="
                        f"{expected_api_port}"
                    )
            except ValueError:
                errors.append(
                    f"API_ENV_INVALID_PORT:{actual_api_port}"
                )

        database_url = api_env.get("DATABASE_URL")

        if not database_url:
            errors.append(
                "API_ENV_MISSING_KEY:DATABASE_URL"
            )
        elif expected_database:
            actual_database = database_name_from_url(
                database_url
            )

            if actual_database != expected_database:
                errors.append(
                    "DATABASE_NAME_MISMATCH:"
                    f"{actual_database}!="
                    f"{expected_database}"
                )

        if api_env.get("NODE_ENV") != "production":
            warnings.append(
                "API_ENV_NODE_ENV_NOT_PRODUCTION"
            )

        worker_mapping = {
            "EDGE_SYNC_WORKER_ENABLED":
                "CLOUD_SYNC_PULL_ENABLED",
            "EDGE_CLOUD_PUSH_WORKER_ENABLED":
                "CLOUD_SYNC_PUSH_ENABLED",
        }

        for env_key, manifest_key in worker_mapping.items():
            expected_value = parse_bool(
                manifest.get(manifest_key, "")
            )
            actual_raw = api_env.get(env_key)

            if profile in {"edge", "edge-standalone"}:
                if actual_raw is None:
                    errors.append(
                        f"API_ENV_MISSING_KEY:{env_key}"
                    )
                    continue

                actual_value = parse_bool(actual_raw)

                if actual_value is None:
                    errors.append(
                        f"API_ENV_INVALID_BOOLEAN:"
                        f"{env_key}={actual_raw}"
                    )
                elif actual_value != expected_value:
                    errors.append(
                        f"API_ENV_CAPABILITY_MISMATCH:"
                        f"{env_key}={actual_raw}"
                    )
            elif actual_raw is not None:
                actual_value = parse_bool(actual_raw)

                if (
                    actual_value is not None
                    and expected_value is not None
                    and actual_value != expected_value
                ):
                    errors.append(
                        f"API_ENV_CAPABILITY_MISMATCH:"
                        f"{env_key}={actual_raw}"
                    )

    if web_env is not None:
        actual_profile = web_env.get(
            "NEXT_PUBLIC_APP_PROFILE"
        )

        if actual_profile != profile:
            errors.append(
                "WEB_ENV_PROFILE_MISMATCH:"
                f"{actual_profile}!={profile}"
            )

        actual_web_port = web_env.get("PORT")

        if actual_web_port is None:
            errors.append("WEB_ENV_MISSING_KEY:PORT")
        elif expected_web_port is not None:
            try:
                if int(actual_web_port) != expected_web_port:
                    errors.append(
                        "WEB_PORT_MISMATCH:"
                        f"{actual_web_port}!="
                        f"{expected_web_port}"
                    )
            except ValueError:
                errors.append(
                    f"WEB_ENV_INVALID_PORT:{actual_web_port}"
                )

        actual_web_dist = web_env.get("NEXT_DIST_DIR")

        if actual_web_dist is None:
            errors.append(
                "WEB_ENV_MISSING_KEY:NEXT_DIST_DIR"
            )
        elif (
            expected_web_dist
            and actual_web_dist != expected_web_dist
        ):
            errors.append(
                "WEB_DIST_MISMATCH:"
                f"{actual_web_dist}!={expected_web_dist}"
            )

        if web_env.get("NODE_ENV") != "production":
            warnings.append(
                "WEB_ENV_NODE_ENV_NOT_PRODUCTION"
            )

        url_checks = {
            "NEXT_PUBLIC_API_BASE_URL":
                expected_api_port,
            "API_BASE_URL":
                expected_api_port,
            "NEXT_PUBLIC_APP_URL":
                expected_web_port,
        }

        for key, expected_port in url_checks.items():
            value = web_env.get(key)

            if not value:
                warnings.append(
                    f"WEB_ENV_MISSING_OPTIONAL_KEY:{key}"
                )
                continue

            # Relative URLs such as /api use the current Web origin
            # and therefore do not contain an explicit API port.
            if value.startswith("/"):
                continue

            actual_port = url_port(value)

            if (
                expected_port is not None
                and actual_port != expected_port
            ):
                warnings.append(
                    f"WEB_URL_PORT_MISMATCH:"
                    f"{key}:{actual_port}!="
                    f"{expected_port}"
                )

    print(f"MANIFEST={manifest_path}")
    print(f"API_ENV={api_env_path}")
    print(f"WEB_ENV={web_env_path}")

    for warning in warnings:
        print(f"WARN={warning}")

    for error in errors:
        print(f"ERROR={error}")

    if errors:
        print(f"PROFILE_VALIDATE_FAILED={profile}")
        return 1

    print(f"PROFILE_VALIDATE_OK={profile}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
