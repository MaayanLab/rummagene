FROM rust as builder
WORKDIR /usr/src/enrich
COPY . .
RUN cargo install --path .

FROM debian:bookworm-slim
COPY --from=builder /usr/src/enrich/Rocket.toml .
COPY --from=builder /usr/local/cargo/bin/enrich /usr/local/bin/enrich
CMD ["enrich"]