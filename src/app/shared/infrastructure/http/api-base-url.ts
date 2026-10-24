import { InjectionToken } from '@angular/core';

/** Origin of pibble, the backend (`http://localhost:8080` in development); endpoint paths are appended to it. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
