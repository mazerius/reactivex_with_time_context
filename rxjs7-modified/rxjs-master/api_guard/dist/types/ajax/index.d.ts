export declare const ajax: AjaxCreationMethod;

export interface AjaxConfig {
    async?: boolean;
    body?: any;
    createXHR?: () => XMLHttpRequest;
    crossDomain?: boolean;
    headers?: Readonly<Record<string, any>>;
    includeDownloadProgress?: boolean;
    includeUploadProgress?: boolean;
    method?: string;
    password?: string;
    progressSubscriber?: PartialObserver<ProgressEvent>;
    responseType?: XMLHttpRequestResponseType;
    timeout?: number;
    url: string;
    user?: string;
    withCredentials?: boolean;
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
}

export interface AjaxError extends Error {
    request: AjaxRequest;
    response: any;
    responseType: XMLHttpRequestResponseType;
    status: number;
    xhr: XMLHttpRequest;
}

export declare const AjaxError: AjaxErrorCtor;

export interface AjaxRequest {
    async: boolean;
    body?: any;
    crossDomain: boolean;
    headers: Readonly<Record<string, any>>;
    method: string;
    password?: string;
    responseType: XMLHttpRequestResponseType;
    timeout: number;
    url: string;
    user?: string;
    withCredentials: boolean;
}

export declare class AjaxResponse<T> {
    readonly loaded: number;
    readonly originalEvent: ProgressEvent;
    readonly request: AjaxRequest;
    readonly response: T;
    readonly responseType: XMLHttpRequestResponseType;
    readonly status: number;
    readonly total: number;
    readonly type: string;
    readonly xhr: XMLHttpRequest;
    constructor(
    originalEvent: ProgressEvent,
    xhr: XMLHttpRequest,
    request: AjaxRequest,
    type?: string);
}

export interface AjaxTimeoutError extends AjaxError {
}

export declare const AjaxTimeoutError: AjaxTimeoutErrorCtor;
