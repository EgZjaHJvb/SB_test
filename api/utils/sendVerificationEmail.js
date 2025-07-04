import nodemailer from 'nodemailer';

export async function sendVerificationEmail(toEmail, otpCode) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail', // use your actual provider
            auth: {
                user: process.env.EMAIL_USER, // your email address
                pass: process.env.EMAIL_PASSWORD, // app password
            },
        });

        const mailOptions = {
            from: `"Quizit App" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: 'Verify your email address - OTP Code',
            html: `
        <div style="font-family:sans-serif;">
          <h2>Email Verification Code</h2>
          <p>Use the following 6-digit OTP to verify your email:</p>
          <h3 style="color:#5145cd">${otpCode}</h3>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ OTP email sent: %s', info.messageId);
    } catch (err) {
        console.error('❌ Failed to send verification email:', err.message);
    }
}

export async function sendPasswordResetEmail(toEmail, resetLink) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"Quizit App" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: 'Reset your Quizitt password',
            html: `
        <div style="font-family:sans-serif;">
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
          <a href="${resetLink}" style="color:#5145cd;">Reset Password</a>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent: %s', info.messageId);
    } catch (err) {
        console.error('❌ Failed to send password reset email:', err.message);
    }
}
