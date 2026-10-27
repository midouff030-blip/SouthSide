import { servers } from 'cfx-api';

export default async function handler(req, res) {
  const serverId = process.env.FIVEM_SERVER_ID;

  if (!serverId) {
    return res.status(500).json({ error: 'FIVEM_SERVER_ID not set' });
  }

  try {
    const server = await servers.single(serverId);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json({
      online: true,
      name: server.hostname,
      players: server.playersCount,
      maxPlayers: server.maxPlayers
    });
  } catch (error) {
    res.status(200).json({ online: false, players: 0, maxPlayers: 0, name: 'SouthSide S2' });
  }
}