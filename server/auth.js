import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail, publicUser } from "./db.js";
import { getSupabaseAdminClient, getSupabaseAuthClient, shouldUseSupabase } from "./supabase.js";

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

export async function registerUser({ name, email, password }) {
  if (shouldUseSupabase()) {
    const admin = getSupabaseAdminClient();
    const auth = getSupabaseAuthClient();
    const normalizedEmail = email.toLowerCase();

    const { error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError && !createError.message.toLowerCase().includes("already")) {
      createError.status = 400;
      throw createError;
    }

    const { data, error } = await auth.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) {
      error.status = createError ? 409 : 401;
      error.message = createError ? "An account already exists for that email." : "Email or password is incorrect.";
      throw error;
    }

    return {
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || name,
        email: data.user.email,
        createdAt: data.user.created_at
      },
      token: data.session.access_token
    };
  }

  if (findUserByEmail(email)) {
    const error = new Error("An account already exists for that email.");
    error.status = 409;
    throw error;
  }

  const user = createUser({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password)
  });

  return { user: publicUser(user), token: signToken(user) };
}

export async function loginUser({ email, password }) {
  if (shouldUseSupabase()) {
    const auth = getSupabaseAuthClient();
    const { data, error } = await auth.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (error) {
      error.status = 401;
      error.message = "Email or password is incorrect.";
      throw error;
    }

    return {
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "User",
        email: data.user.email,
        createdAt: data.user.created_at
      },
      token: data.session.access_token
    };
  }

  const user = findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  return { user: publicUser(user), token: signToken(user) };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }

  try {
    if (shouldUseSupabase()) {
      const auth = getSupabaseAuthClient();
      const { data, error } = await auth.auth.getUser(token);
      if (error || !data.user) {
        return res.status(401).json({ error: "Your session expired. Please sign in again." });
      }
      req.user = {
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "User",
        email: data.user.email,
        createdAt: data.user.created_at
      };
      return next();
    }

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
