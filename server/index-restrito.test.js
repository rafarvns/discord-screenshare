/**
 * O servidor em modo restrito: só membros de um servidor do Discord entram.
 *
 * Arquivo separado porque `DISCORD_GUILD_ID` é lido no corpo do módulo, uma
 * vez: com ele preenchido, é outro servidor. Aqui se testa cada porta que antes
 * deixava um estranho entrar — convidado, sessão de teste, login pelo site,
 * atividade aberta em outro servidor — e a última barreira, no WebSocket.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const GUILD = '100000000000000001';
const OUTRA_GUILD = '100000000000000002';
const MEMBRO = '300000000000000001';
const CANAL = '200000000000000001';

process.env.DISCORD_GUILD_ID = GUILD;
process.env.DISCORD_CLIENT_ID = '111111111111111111';
process.env.DISCORD_CLIENT_SECRET = 'segredo-da-aplicacao';
process.env.DISCORD_BOT_TOKEN = 'token-do-bot';
process.env.PUBLIC_ORIGIN = 'https://exemplo.test';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const fetchReal = globalThis.fetch;
const { server, wss } = await import('./index.js');
const { signToken } = await import('./tokens.js');
const R = await import('./rooms.js');
if (!server.listening) await new Promise((pronto) => server.once('listening', pronto));
const porta = server.address().port;
const base = `http://127.0.0.1:${porta}`;

/** Rotas externas fingidas, na ordem em que foram registradas. */
let externas = [];
const finge = (padrao, responder) => externas.push([padrao, responder]);

vi.stubGlobal('fetch', async (url, init) => {
  const alvo = String(url);
  for (const [padrao, responder] of externas) {
    const bate = padrao instanceof RegExp ? padrao.test(alvo) : alvo.startsWith(padrao);
    if (bate) return responder(alvo, init);
  }
  if (alvo.startsWith(base)) return fetchReal(url, init);
  throw new Error(`chamada externa não prevista: ${alvo}`);
});

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const post = (caminho, corpo) =>
  fetch(`${base}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
    redirect: 'manual',
  });

const get = (caminho) => fetch(`${base}${caminho}`, { redirect: 'manual' });

/** O Discord respondendo como se MEMBRO estivesse na call do servidor. */
function discordCom(membro) {
  finge('https://discord.com/api/users/@me', () => json({ id: MEMBRO, global_name: 'Alice' }));
  finge(new RegExp(`/guilds/\\d+/members/${MEMBRO}$`), membro);
  finge(/\/voice-states\//, () => json({ channel_id: CANAL }));
  finge(/\/guilds\/\d+$/, () => json({ name: 'Servidor' }));
}

const abrir = (guild = GUILD) =>
  post('/api/session', {
    access_token: 'tok',
    instance_id: 'i',
    guild_id: guild,
    channel_id: CANAL,
  });

/** Uma identidade assinada pelo servidor, com ou sem o servidor carimbado. */
const identidade = (extra = {}) =>
  signToken({ instance: 'i', uid: 'u', name: 'U', scope: 'identity', ...extra }, 3600);

function recusaWs(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${porta}/ws?t=${encodeURIComponent(token)}`);
    ws.once('unexpected-response', (_req, res) => resolve(res.statusCode));
    ws.once('open', () => {
      ws.close();
      resolve('abriu');
    });
    ws.once('error', () => resolve('erro'));
  });
}

beforeEach(() => {
  externas = [];
});

afterAll(async () => {
  wss.close();
  await new Promise((pronto) => server.close(pronto));
});

describe('/api/session no modo restrito', () => {
  it('deixa entrar o membro confirmado, com o servidor carimbado no token', async () => {
    discordCom(() => json({ user: { id: MEMBRO } }));

    const resposta = await abrir();
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.guild).toBe(GUILD);

    const sala = await post('/api/rooms/call', { identity: corpo.identity });
    expect(sala.status).toBe(200);
  });

  it('recusa a atividade aberta em outro servidor, sem nem consultar o bot', async () => {
    discordCom(() => {
      throw new Error('não devia consultar o membro');
    });

    const resposta = await abrir(OUTRA_GUILD);

    expect(resposta.status).toBe(403);
  });

  it('recusa a atividade aberta fora de servidor (DM)', async () => {
    discordCom(() => json({}));

    expect((await abrir(null)).status).toBe(403);
  });

  it('recusa quem não é membro', async () => {
    discordCom(() => json({ code: 10007, message: 'Unknown Member' }, 404));

    expect((await abrir()).status).toBe(403);
  });

  it('falha fechado quando o bot não está no servidor', async () => {
    discordCom(() => json({ code: 10004, message: 'Unknown Guild' }, 404));

    expect((await abrir()).status).toBe(503);
  });

  it('falha fechado quando o Discord não responde', async () => {
    discordCom(() => {
      throw new Error('rede fora');
    });

    expect((await abrir()).status).toBe(503);
  });
});

describe('portas que antes deixavam estranhos entrar', () => {
  it('não emite convidado', async () => {
    expect((await post('/api/session-guest', { name: 'Estranho' })).status).toBe(404);
  });

  it('não emite sessão de teste, mesmo fora de produção', async () => {
    expect((await post('/api/session-dev', { call: CANAL })).status).toBe(404);
  });

  it('o login pelo site volta sem identidade', async () => {
    const login = await get('/auth/login');
    expect(login.headers.get('location')).toBe('/?erro=restrito');

    const callback = await get('/auth/callback?code=abc');
    expect(callback.headers.get('location')).toBe('/?erro=restrito');
  });

  it('o login do painel segue pelo Discord', async () => {
    // Sem DISCORD_ADMIN_ID o painel está desligado, mas a rota não é desviada
    // para o aviso do modo restrito.
    const resposta = await get('/admin/auth/login');
    expect(resposta.headers.get('location')).not.toBe('/?erro=restrito');
  });

  it('identidade sem servidor (convidado antigo) não cria sala', async () => {
    const resposta = await post('/api/rooms/create', { identity: identidade(), name: 'x' });

    expect(resposta.status).toBe(403);
  });

  it('identidade de outro servidor não entra na sala da call', async () => {
    const resposta = await post('/api/rooms/call', {
      identity: identidade({ guild: OUTRA_GUILD, call: CANAL }),
    });

    expect(resposta.status).toBe(403);
  });

  it('a lista sai vazia sem identidade de membro', async () => {
    R.createRoom({ instance: 'web', name: 'Sala web', ownerId: 'g', ownerName: 'G' });

    const corpo = await (await post('/api/rooms/list', {})).json();

    expect(corpo.rooms).toEqual([]);
  });

  it('ingresso sem servidor não abre sala pelo site', async () => {
    const { room } = R.createRoom({ instance: 'web', name: 'Sala', ownerId: 'g', ownerName: 'G' });
    const ingresso = signToken({ room: room.id, uid: 'g', name: 'G', role: 'viewer' });

    expect((await post('/api/rooms/open', { token: ingresso })).status).toBe(403);
  });

  it('ingresso de membro abre a sala pelo site', async () => {
    const { room } = R.createRoom({ instance: 'i', name: 'Sala', ownerId: 'u', ownerName: 'U' });
    const ingresso = signToken({
      room: room.id,
      uid: 'u',
      name: 'U',
      role: 'viewer',
      guild: GUILD,
    });

    expect((await post('/api/rooms/open', { token: ingresso })).status).toBe(200);
  });
});

describe('WebSocket no modo restrito', () => {
  it('recusa token de sala sem servidor', async () => {
    const { room } = R.createRoom({ instance: 'web', name: 'Sala', ownerId: 'g', ownerName: 'G' });

    expect(await recusaWs(signToken({ room: room.id, uid: 'g', name: 'G', role: 'viewer' }))).toBe(
      403,
    );
  });

  it('aceita token de sala de membro', async () => {
    const { room } = R.createRoom({ instance: 'i', name: 'Sala', ownerId: 'u', ownerName: 'U' });
    const token = signToken({ room: room.id, uid: 'u', name: 'U', role: 'viewer', guild: GUILD });

    expect(await recusaWs(token)).toBe('abriu');
  });
});

describe('/api/config', () => {
  it('avisa o cliente que o site não abre lobby', async () => {
    const corpo = await (await get('/api/config')).json();

    expect(corpo.restrito).toBe(true);
  });
});
