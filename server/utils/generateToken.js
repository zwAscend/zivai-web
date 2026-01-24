import jwt from 'jsonwebtoken';

// Generate JWT token
const generateToken = (id, role, studentId) => {
  return jwt.sign(
    { id, role, studentId }, // The payload now includes role and studentId
    process.env.JWT_SECRET || 'secret123', {
      expiresIn: '30d',
    }
  );
};

export default generateToken;