// Public devnet reward addresses from pouw-deploy/compose.yml (PR #65).
// Override at build time when deploying a network with different reward keys.
export const configuredMiners = [
  { label: "Node 1", miner: import.meta.env.VITE_NODE_1_MINER_ADDRESS || "addr:8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c" },
  { label: "Node 2", miner: import.meta.env.VITE_NODE_2_MINER_ADDRESS || "addr:43a72e714401762df66b68c26dfbdf2682aaec9f2474eca4613e424a0fbafd3c" },
  { label: "Node 3", miner: import.meta.env.VITE_NODE_3_MINER_ADDRESS || "addr:66be7e332c7a453332bd9d0a7f7db055f5c5ef1a06ada66d98b39fb6810c473a" },
];
