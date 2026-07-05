import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_SECRET || "dev-only-secret-change-me";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    },
    secret(),
    { expiresIn: "7d" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }

  try {
    const payload = jwt.verify(token, secret());
    req.user = {
      id: payload.sub,
      name: payload.name || payload.email?.split("@")[0] || "User",
      email: payload.email,
      createdAt: payload.createdAt
    };
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired. Please sign in again." });
  }
}
