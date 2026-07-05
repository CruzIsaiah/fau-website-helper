import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserById, publicUser } from "./db.js";

const secret = () => process.env.JWT_SECRET || "dev-only-secret-change-me";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, secret(), { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }

  try {
    const payload = jwt.verify(token, secret());
    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Your session is no longer valid." });
    }
    req.user = publicUser(user);
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired. Please sign in again." });
  }
}
