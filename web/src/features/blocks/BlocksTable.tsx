import { Link } from "react-router-dom";
import type { Block } from "./api";
import { AddressLink, EmptyState } from "../../components/ui";
import { number } from "../../lib/formatters";
export function BlocksTable({
  blocks,
  preview = false,
}: {
  blocks: Block[];
  preview?: boolean;
}) {
  if (!blocks.length) return <EmptyState message="No blocks found." />;
  return (
    <div className={`table-scroll ${preview ? "preview-table" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>{preview ? "Block" : "Block ID"}</th>
            <th>Miner</th>
            <th>{preview ? "Coin Transaction" : "Coin Tx"}</th>
            <th>{preview ? "Proof Transactions" : "Proof Tx"}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.hash}>
              <td>
                <Link to={`/blocks/${encodeURIComponent(block.hash)}`}>
                  {preview ? number(block.height) : `#${block.height}`}
                </Link>
              </td>
              <td>
                <AddressLink address={block.miner} />
              </td>
              <td>
                {number(
                  Number(block.transfer_count) +
                    Number(block.registration_count),
                )}
              </td>
              <td>{number(block.proof_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
