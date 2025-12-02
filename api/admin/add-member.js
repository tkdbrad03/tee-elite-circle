import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      full_name, 
      email, 
      phone, 
      location, 
      pin_number,
      paid_in_full,
      deposit_paid,
      interest_level,
      status
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !location || !pin_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if pin number is already taken
    const existingPin = await sql`
      SELECT id FROM applications WHERE pin_number = ${pin_number}
    `;
    
    if (existingPin.rows.length > 0) {
      return res.status(400).json({ error: `Pin #${String(pin_number).padStart(2, '0')} is already assigned` });
    }

    // Check if email already exists
    const existingEmail = await sql`
      SELECT id FROM applications WHERE email = ${email}
    `;
    
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'A member with this email already exists' });
    }

    // Insert new member
    const result = await sql`
      INSERT INTO applications (
        full_name,
        email,
        phone,
        location,
        pin_number,
        paid_in_full,
        deposit_paid,
        interest_level,
        status,
        created_at
      ) VALUES (
        ${full_name},
        ${email},
        ${phone},
        ${location},
        ${pin_number},
        ${paid_in_full || true},
        ${deposit_paid || true},
        ${interest_level || 'Ready to secure my founding seat'},
        ${status || 'approved'},
        NOW()
      )
      RETURNING id
    `;

    return res.status(200).json({ 
      success: true, 
      id: result.rows[0].id,
      message: 'Member added successfully'
    });

  } catch (error) {
    console.error('Error adding member:', error);
    return res.status(500).json({ error: 'Failed to add member' });
  }
}
