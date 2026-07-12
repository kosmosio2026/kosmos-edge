import { apiFetch } from './api-client';

type ApiOptions = {
  accessToken?: string;
};

export function listDisplayControllers(options: ApiOptions = {}) {
  return apiFetch('/display/controllers', {
    accessToken: options.accessToken,
  });
}

export function getDisplayController(id: string, options: ApiOptions = {}) {
  return apiFetch(`/display/controllers/${id}`, {
    accessToken: options.accessToken,
  });
}

export function createDisplayController(dto: any, options: ApiOptions = {}) {
  return apiFetch('/display/controllers', {
    method: 'POST',
    accessToken: options.accessToken,
    body: JSON.stringify(dto),
  });
}

export function updateDisplayController(
  id: string,
  dto: any,
  options: ApiOptions = {},
) {
  return apiFetch(`/display/controllers/${id}`, {
    method: 'PATCH',
    accessToken: options.accessToken,
    body: JSON.stringify(dto),
  });
}

export function deleteDisplayController(id: string, options: ApiOptions = {}) {
  return apiFetch(`/display/controllers/${id}`, {
    method: 'DELETE',
    accessToken: options.accessToken,
  });
}

export function publishDisplayController(id: string, options: ApiOptions = {}) {
  return apiFetch(`/display/controllers/${id}/publish`, {
    method: 'POST',
    accessToken: options.accessToken,
  });
}

export function pingDisplayController(id: string, options: ApiOptions = {}) {
  return apiFetch(`/display/controllers/${id}/ping`, {
    accessToken: options.accessToken,
  });
}

export function getDisplayBoard(accessToken: string, id: string) {
  return apiFetch(`/display/controllers/${id}`, {
    accessToken,
  });
}

export function updateDisplayBoard(
  accessToken: string,
  id: string,
  dto: any,
) {
  return apiFetch(`/display/controllers/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(dto),
  });
}