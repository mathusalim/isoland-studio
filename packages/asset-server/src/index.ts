import Fastify from 'fastify'

const server = Fastify({ logger: true })
const PORT = Number(process.env.PORT ?? 3001)

server.get('/health', async () => ({ status: 'ok' }))

// Generation API — to be implemented
server.post('/api/generate', async (_request, reply) => {
  reply.code(501).send({ error: 'not implemented' })
})

await server.listen({ port: PORT, host: '0.0.0.0' })
