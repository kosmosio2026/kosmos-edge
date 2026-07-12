# Mobile / QR / Watcher Roadmap

## Phase 1. QR Registration MVP

Status: Done

- Public parking lot region API
- Parking lot QR token API
- QR parking lot lookup
- Member QR registration
- Visitor QR registration
- Parking session mapping by selected parking space

## Phase 2. Watcher MVP

Status: In Progress

- Watcher signup/login page
- Watcher parking lot application
- Manager/Admin watcher approval page
- Watcher approved parking lot binding
- Watcher enforcement case list
- Watcher authority registration
- Authority registration log
- Vehicle plate photo required for authority registration

## Phase 3. Vehicle Plate Photo Upload and Mock OCR

Status: In Progress

Goal:
- Add photo upload UI for watcher authority registration.
- Add Korean vehicle plate recognition module interface.
- Use mock provider first.
- Replace mock provider with real OCR implementation later without changing UI flow.

Current implementation:
- API: POST /api/plate-recognition/recognize
- Provider: MOCK_KR_PLATE_OCR
- Input: imageBase64, imageUrl, fileName, plateHint
- Output: plateNumber, confidence, candidates, provider, mode
- Watcher UI uploads photo and auto-fills plate number from mock OCR.

Mock behavior:
- If plateHint or fileName includes a Korean plate pattern, return that.
- Otherwise return default mock plate: 12가3456.

Future replacement:
- Replace PlateRecognitionService provider internals.
- Keep API contract.
- Keep watcher UI unchanged.

## Phase 4. Real Korean Plate OCR

Status: Planned

Tasks:
- Evaluate OCR options for Korean vehicle plates.
- Add preprocessing pipeline:
  - image resize
  - crop candidate region
  - contrast normalization
  - blur/noise handling
  - perspective correction
- Add real recognition provider:
  - local OCR model, cloud OCR, or hybrid provider
- Add confidence threshold rules.
- Add manual correction flow.
- Store OCR metadata:
  - provider
  - confidence
  - candidates
  - raw response
  - reviewed plate number
  - reviewed by user
- Add QA dataset for Korean license plate formats.
- Add privacy/security policy for vehicle images.

Acceptance criteria:
- Watcher can upload or capture vehicle plate photo.
- System suggests Korean plate number.
- Watcher can manually correct recognized plate.
- Authority registration stores:
  - final plate number
  - photo URL
  - OCR provider
  - OCR confidence
  - OCR candidates
  - registrar
  - timestamp

## Phase 5. Real File Storage

Status: Planned

Tasks:
- Add image upload endpoint.
- Store images in local storage, S3-compatible storage, or NAS.
- Save durable image URL in ParkingRegistrationPhoto.
- Add access control for photo retrieval.
- Add retention policy.

## Phase 6. PWA / Android Conversion

Status: Planned

Tasks:
- Add manifest
- Add service worker
- Add mobile icons
- Test camera capture on Android tablet/phone
- Evaluate Capacitor wrapper

## Phase 4A. OCR Image Payload Policy

Status: Planned

Decisions:
- Do not store base64 images in PostgreSQL.
- Do not send original full-size images to OCR API.
- Browser should resize/compress image before OCR request.
- Recommended OCR payload:
  - maxWidth: 1280px
  - format: JPEG
  - quality: 0.75~0.8
  - field: imageBase64
- The OCR API may receive imageBase64 for recognition only.
- The OCR API must not persist imageBase64.
- Durable evidence image should be uploaded through a separate file upload endpoint.
- Database should store:
  - imageUrl
  - thumbnailUrl, optional
  - OCR provider
  - OCR confidence
  - OCR candidates
  - final reviewed plate number
  - createdAt / capturedByUserId

Implementation note:
- The current Watcher UI already contains resizeImageForOcr().
- The call is intentionally disabled during Mock OCR.
- When replacing MOCK_KR_PLATE_OCR with a real provider, enable:
  - const ocrImageBase64 = await resizeImageForOcr(file, 1280, 0.78)
  - send imageBase64: ocrImageBase64 to POST /api/plate-recognition/recognize
