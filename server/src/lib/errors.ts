/** An error that maps directly to an HTTP response: `{ ok: false, error }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "queue") => new HttpError(404, `That ${what} is no longer here.`);
