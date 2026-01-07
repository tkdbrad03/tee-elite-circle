const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

// Base email template with Tee Elite Circle branding
const emailTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Tee Elite Circle</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: 'Georgia', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF8F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a2f23; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; color: #e8ccc8; font-style: italic;">TMac Inspired presents</p>
              <h1 style="margin: 0; font-size: 28px; font-weight: 400; color: #ffffff; letter-spacing: 0.05em;">The Tee Elite Circle</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 48px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a2f23; padding: 32px 48px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff;">The Tee Elite Circle</p>
              <p style="margin: 0 0 16px 0; font-size: 11px; letter-spacing: 0.15em; color: #e8ccc8;">WHERE GOLF MEETS GREATNESS</p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.4);">A TMac Inspired Experience</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Send email function
const sendEmail = async ({ to, subject, content }) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"The Tee Elite Circle" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: emailTemplate(content)
  };
  
  return transporter.sendMail(mailOptions);
};

// Email Templates

// Admin notification email
const ADMIN_EMAIL = 'info@tmacmastermind.com';

const adminNewApplicationEmail = (application) => ({
  subject: `New Application: ${application.full_name}`,
  content: `
    <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 400; color: #2C2C2C;">New Application Received</h2>
    
    <div style="margin: 0 0 24px 0; padding: 24px; background-color: #f7f0ef;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Name:</strong> ${application.full_name}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Email:</strong> ${application.email}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Phone:</strong> ${application.phone || 'Not provided'}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Location:</strong> ${application.location}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Golf Relationship:</strong> ${application.golf_relationship}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Season of Life:</strong> ${application.season_of_life}</p>
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #555555;"><strong>Interest Level:</strong> <span style="color: ${application.interest_level.includes('Ready') ? '#27ae60' : '#a67c52'}; font-weight: 500;">${application.interest_level}</span></p>
    </div>
    
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #555555;"><strong>What draws them to The Circle:</strong></p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #555555; line-height: 1.8; padding: 16px; background-color: #fff; border-left: 3px solid #a67c52;">${application.what_draws_you}</p>
    
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #555555;"><strong>What they want to elevate:</strong></p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #555555; line-height: 1.8; padding: 16px; background-color: #fff; border-left: 3px solid #a67c52;">${application.what_to_elevate}</p>
    
    ${application.anything_else ? `
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #555555;"><strong>Additional notes:</strong></p>
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #555555; line-height: 1.8; padding: 16px; background-color: #fff; border-left: 3px solid #a67c52;">${application.anything_else}</p>
    ` : ''}
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://tmacmastermind.com/admin.html" style="display: inline-block; background-color: #1a2f23; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">View in Admin Panel</a>
    </div>
  `
});

const adminDepositPaidEmail = (name, email) => ({
  subject: `💰 Deposit Paid: ${name}`,
  content: `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 64px; height: 64px; background-color: #27ae60; border-radius: 50%; line-height: 64px; text-align: center;">
        <span style="color: #ffffff; font-size: 28px;">$</span>
      </div>
    </div>
    
    <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 400; color: #2C2C2C; text-align: center;">Deposit Payment Received!</h2>
    
    <div style="margin: 0 0 24px 0; padding: 24px; background-color: #e8f8f0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #555555;"><strong>${name}</strong></p>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #555555;">${email}</p>
      <p style="margin: 0; font-size: 24px; color: #27ae60; font-weight: 500;">$2,000 Deposit Paid</p>
    </div>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555; text-align: center;">
      This applicant has completed their founding member deposit. Remaining balance: $13,000.
    </p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://tmacmastermind.com/admin.html" style="display: inline-block; background-color: #1a2f23; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">View in Admin Panel</a>
    </div>
  `
});

const applicationReceivedEmail = (name) => ({
  subject: "We've Received Your Application — The Tee Elite Circle",
  content: `
    <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 400; color: #2C2C2C;">Thank You, ${name}</h2>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      We've received your application to join The Tee Elite Circle as a Founding Member.
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      This is not just a membership — it's an invitation to a room where extraordinary women gather, connect, and elevate. We take our time reviewing each application to ensure alignment with the vision and the women already in the circle.
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      If there's a fit, you'll hear from us personally with next steps.
    </p>
    
    <div style="margin: 32px 0; padding: 24px; background-color: #f7f0ef; border-left: 3px solid #a67c52;">
      <p style="margin: 0; font-size: 14px; font-style: italic; color: #2C2C2C;">
        "The right people, at the right time, in the right room."
      </p>
    </div>
    
    <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #555555;">
      With anticipation,<br>
      <strong style="color: #2C2C2C;">Dr. TMac</strong><br>
      <span style="font-size: 13px; color: #a67c52;">Founder, The Tee Elite Circle</span>
    </p>
  `
});

const depositConfirmedEmail = (name) => ({
  subject: "You're In — Founding Member Deposit Confirmed",
  content: `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 64px; height: 64px; background-color: #1a2f23; border-radius: 50%; line-height: 64px; text-align: center;">
        <span style="color: #e8ccc8; font-size: 28px;">✓</span>
      </div>
    </div>
    
    <h2 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 400; color: #2C2C2C; text-align: center;">Welcome, ${name}</h2>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555; text-align: center;">
      Your $2,000 deposit has been received. You've officially secured your seat as a Founding Member of The Tee Elite Circle.
    </p>
    
    <div style="margin: 32px 0; padding: 32px; background-color: #1a2f23; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.2em; color: #e8ccc8;">YOUR INVESTMENT</p>
      <p style="margin: 0 0 4px 0; font-size: 14px; color: rgba(255,255,255,0.7);">$2,000 deposit received</p>
      <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.7);">$13,000 remaining balance</p>
    </div>
    
    <h3 style="margin: 32px 0 16px 0; font-size: 18px; font-weight: 400; color: #2C2C2C;">Next Steps</h3>
    
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      <strong>Option 1: Wire the remaining balance</strong><br>
      Complete your investment by wiring $13,000 to secure immediate access.
    </p>
    
    <div style="margin: 16px 0 24px 0; padding: 20px; background-color: #f7f0ef; font-size: 13px; color: #555555;">
      <strong>Bank:</strong> GTE Financial<br>
      <strong>ABA Routing:</strong> 263182794<br>
      <strong>Account:</strong> 482377168<br>
      <strong>Business Name:</strong> TMac Inspired LLC
    </div>
    
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      <strong>Option 2: Need funding?</strong><br>
      Explore financing options through our partner (credit 620+, income $40K+):<br>
      <a href="https://www.eazeconsulting.com/apply?cl=FZD4W&ag=XLIXA1QT23" style="color: #a67c52;">Apply for Funding</a>
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      <strong>Option 3: Book a call</strong><br>
      Have questions? Let's talk.<br>
      <a href="https://complitrst-booking.web.app/?type=tee-elite-circle" style="color: #a67c52;">Schedule Your Call</a>
    </p>
    
    <p style="margin: 32px 0 0 0; font-size: 15px; line-height: 1.8; color: #555555;">
      Welcome to the room,<br>
      <strong style="color: #2C2C2C;">Dr. TMac</strong>
    </p>
  `
});

const welcomeEmail = (name, email, tempPassword, pinNumber) => ({
  subject: "Your Founding Member Access — The Tee Elite Circle",
  content: `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 80px; height: 80px; border: 2px solid #e8ccc8; border-radius: 50%; line-height: 76px; text-align: center;">
        <span style="color: #a67c52; font-size: 32px; font-family: Georgia, serif;">#${String(pinNumber).padStart(2, '0')}</span>
      </div>
    </div>
    
    <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 400; color: #2C2C2C; text-align: center;">Welcome, Founding Member</h2>
    <p style="margin: 0 0 32px 0; font-size: 14px; color: #a67c52; text-align: center; letter-spacing: 0.1em;">PIN #${String(pinNumber).padStart(2, '0')}</p>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      ${name}, you're officially one of us.
    </p>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      Your investment is complete, and your place in The Tee Elite Circle is secured. As Founding Member #${String(pinNumber).padStart(2, '0')}, you'll receive your custom pin at the First Tee ceremony — a symbol of your commitment to playing life at the highest level.
    </p>
    
    <div style="margin: 32px 0; padding: 32px; background-color: #1a2f23; text-align: center;">
      <p style="margin: 0 0 20px 0; font-size: 12px; letter-spacing: 0.2em; color: #e8ccc8;">YOUR MEMBER PORTAL ACCESS</p>
      
      <p style="margin: 0 0 8px 0; font-size: 13px; color: rgba(255,255,255,0.7);">Email</p>
      <p style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">${email}</p>
      
      <p style="margin: 0 0 8px 0; font-size: 13px; color: rgba(255,255,255,0.7);">Temporary Password</p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #ffffff; font-family: monospace;">${tempPassword}</p>
      
      <a href="https://tmacmastermind.com/member-login.html" style="display: inline-block; background-color: #e8ccc8; color: #1a2f23; text-decoration: none; padding: 14px 32px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">Access Your Portal</a>
    </div>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      Inside your member portal, you'll find:
    </p>
    
    <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 15px; line-height: 2; color: #555555;">
      <li>Member directory — connect with your fellow Founding Members</li>
      <li>Wins feed — celebrate and share victories</li>
      <li>Between the Tees — our private discussion space</li>
      <li>The Vault — exclusive resources and materials</li>
    </ul>
    
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.8; color: #555555;">
      Please change your password after your first login.
    </p>
    
    <div style="margin: 32px 0; padding: 24px; background-color: #f7f0ef; border-left: 3px solid #a67c52;">
      <p style="margin: 0; font-size: 14px; font-style: italic; color: #2C2C2C;">
        "You didn't just join a group. You entered a room that will change your life."
      </p>
    </div>
    
    <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #555555;">
      See you on the green,<br>
      <strong style="color: #2C2C2C;">Dr. TMac</strong><br>
      <span style="font-size: 13px; color: #a67c52;">Founder, The Tee Elite Circle</span>
    </p>
  `
});

module.exports = {
  sendEmail,
  applicationReceivedEmail,
  depositConfirmedEmail,
  welcomeEmail,
  adminNewApplicationEmail,
  adminDepositPaidEmail,
  ADMIN_EMAIL
};
