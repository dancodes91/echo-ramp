import { SignJWT, jwtVerify } from 'jose';

import { config } from '../config/index.js';

const encoder = new TextEncoder();

function getSecretKey(): Uint8Array {
  return encoder.encode(config.JWT_SECRET);
}

export interface ClientTokenPayload {
  sessionId: string;
  userId: string;
  integratorId: string;
  clientTokenVersion: number;
}

export async function signClientToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({
    user_id: payload.userId,
    integrator_id: payload.integratorId,
    ver: payload.clientTokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecretKey());
}

export async function verifyClientToken(token: string): Promise<ClientTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ['HS256'],
  });

  const sessionId = payload.sub;
  const userId = payload.user_id;
  const integratorId = payload.integrator_id;
  const clientTokenVersion = payload.ver;

  if (
    typeof sessionId !== 'string' ||
    typeof userId !== 'string' ||
    typeof integratorId !== 'string' ||
    typeof clientTokenVersion !== 'number'
  ) {
    throw new Error('Invalid client token payload');
  }

  return { sessionId, userId, integratorId, clientTokenVersion };
}
