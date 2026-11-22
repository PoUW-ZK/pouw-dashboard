import { Link } from "react-router-dom";
import type { Block } from "./api";
import { AddressLink, EmptyState } from "../../components/ui";
import { date, number, sumIntegers } from "../../lib/formatters";
import { showPouw } from "../../lib/config";
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
            <th>Transactions</th>
            <th>{showPouw ? "Proof transactions" : "Time"}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.hash}>
              <td>
                <Link to={`/blocks/${encodeURIComponent(block.hash)}`}>
                  #{number(block.height)}
                </Link>
              </td>
              <td>
                <AddressLink address={block.miner} />
              </td>
              <td>
                {number(showPouw ? sumIntegers(block.transfer_count, block.registration_count) : block.transfer_count)}
              </td>
              <td>{showPouw ? number(block.proof_count) : date(block.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
