// Cookie utility for consistent cookie handling across the application

export const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        // Don't set domain in production to allow cookies to work across different domains
        ...(isProduction ? {} : { domain: 'localhost' })
    };
};

export const clearCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        // Don't set domain in production
        ...(isProduction ? {} : { domain: 'localhost' })
    };
};