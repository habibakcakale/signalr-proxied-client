import request from "request";
import { HttpClient, HttpRequest, HttpResponse, AbortError, TimeoutError, HttpError } from "@microsoft/signalr";

export interface ProxySettings {
    protocol?: string
    user?: string;
    password?: string;
    host?: string;
    port?: string;
}


export function createProxiedClient(proxy: ProxySettings) {
    var proxyUrl = buildProxyUrl(proxy);
    return class NodeHttpClient extends HttpClient {
        cookieJar: request.CookieJar;
        request: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>;
        constructor() {
            super();
            this.cookieJar = request.jar();
            this.request = request.defaults({ jar: this.cookieJar, proxy: proxyUrl });
        }


        public send(httpRequest: HttpRequest): Promise<HttpResponse> {
            // Check that abort was not signaled before calling send
            if (httpRequest.abortSignal) {
                if (httpRequest.abortSignal.aborted) {
                    return Promise.reject(new AbortError());
                }
            }

            return new Promise<HttpResponse>((resolve, reject) => {

                let requestBody: Buffer | string;
                if (isArrayBuffer(httpRequest.content)) {
                    requestBody = Buffer.from(httpRequest.content);
                }
                else {
                    requestBody = httpRequest.content || "";
                }

                const currentRequest = this.request(httpRequest.url!, {
                    body: requestBody,
                    // If binary is expected 'null' should be used, otherwise for text 'utf8'
                    encoding: httpRequest.responseType === "arraybuffer" ? null : "utf8",
                    headers: {
                        // Tell auth middleware to 401 instead of redirecting
                        "X-Requested-With": "XMLHttpRequest",
                        ...httpRequest.headers,
                    },
                    method: httpRequest.method,
                    timeout: httpRequest.timeout,
                },
                    (error, response, body) => {
                        if (httpRequest.abortSignal) {
                            httpRequest.abortSignal.onabort = null;
                        }

                        if (error) {
                            if (error.code === "ETIMEDOUT") {
                                reject(new TimeoutError());
                            }
                            reject(error);
                            return;
                        }

                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve(new HttpResponse(response.statusCode, response.statusMessage || "", body));
                        }
                        else {
                            reject(new HttpError(response.statusMessage || "", response.statusCode || 0));
                        }
                    });

                if (httpRequest.abortSignal) {
                    httpRequest.abortSignal.onabort = () => {
                        currentRequest.abort();
                        reject(new AbortError());
                    };
                }
            });
        }


        public getCookieString(url: string): string {
            return this.cookieJar.getCookieString(url);
        }
    };
    function isArrayBuffer(val: any): val is ArrayBuffer {
        return val && typeof ArrayBuffer !== "undefined" &&
            (val instanceof ArrayBuffer ||
                // Sometimes we get an ArrayBuffer that doesn't satisfy instanceof
                (val.constructor && val.constructor.name === "ArrayBuffer"));
    }
    function buildProxyUrl(settings: ProxySettings): string | undefined {
        if (!settings || !settings.host)
            return undefined;
        var proxyUrl = settings.protocol || "http://";
        if (settings.user || settings.password) {
            proxyUrl += (settings.user || "") + ":" + (settings.password || "") + "@";
        }
        proxyUrl += settings.host + (settings.port ? (":" + settings.port) : "");
        return proxyUrl;
    }
}
