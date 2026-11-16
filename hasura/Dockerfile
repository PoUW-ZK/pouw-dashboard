# GraphQL API of the explorer: Hasura with the metadata from this directory.
# The schema and the api views are owned by pouw-indexer (its migrations), Hasura only tracks them.
#
# On start the image applies metadata/ and refuses to start if it references
# tables or columns that do not exist (inconsistent metadata).
FROM hasura/graphql-engine:v2.51.1.cli-migrations-v3

# Requests without a token (the explorer) get the read-only role of metadata/,
# the same locally, in CI and on staging
ENV HASURA_GRAPHQL_DISALLOW_INCONSISTENT_METADATA=true \
    HASURA_GRAPHQL_UNAUTHORIZED_ROLE=anonymous \
    HASURA_GRAPHQL_ENABLE_TELEMETRY=false \
    HASURA_GRAPHQL_ENABLE_ALLOWLIST=true \
    HOME=/tmp

COPY metadata /hasura-metadata

# nobody, the engine does not need root
USER 65534
