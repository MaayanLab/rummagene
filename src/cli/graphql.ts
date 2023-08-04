import http from "http"
import postgraphile from "@/lib/postgraphile"

http
  .createServer(postgraphile)
  .listen(3000, '0.0.0.0', () => {
    console.log('listening on http://0.0.0.0:3000')
  })
