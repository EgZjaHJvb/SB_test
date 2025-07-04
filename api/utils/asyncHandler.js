/**
 * Wraps an asynchronous Express route handler to catch errors and pass them to `next()`.
 * Useful for avoiding repetitive try/catch blocks in async route handlers.
 *
 * @param {import('express').RequestHandler} requestHandle - An asynchronous Express request handler.
 * @returns {import('express').RequestHandler} - A new handler that automatically catches errors.
 */
export default function asyncHandle(requestHandle) {
    return (req, res, next) => {
        Promise.resolve(requestHandle(req, res, next)).catch(next);
    };
}
