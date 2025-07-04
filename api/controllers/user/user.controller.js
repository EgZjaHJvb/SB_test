import { clearCookieOptions } from '../../utils/cookieUtils.js';

/* 

This controller accounts from the stupid design decision made by previous people and their out of the world 
thought for not making a logout route & controller.

TLDR : cookies can't be accessed from FE if they are set to secure HTTP only 

and somehow our pretty application need it to be.

*/

export const logout = async (req, res) => {
    const token = req.cookies?.token;
    const options = clearCookieOptions();

    if (!token) {
        return res
            .status(200)
            .clearCookie('token', options)
            .json({ statusCode: 200, message: 'User already logged out' });
    }

    return res
        .status(200)
        .clearCookie('token', options)
        .json({ statusCode: 200, message: 'User logged out successfully' });
};
