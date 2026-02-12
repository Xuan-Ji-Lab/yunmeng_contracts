const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x73b39883178bbea38a9c88e4a27c706e63af7b2835058fcf6d6376cb6a6a9344";
  console.log(`Inspecting transaction: ${txHash} on network: ${hre.network.name}`);

  const provider = ethers.provider;
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!tx || !receipt) {
    console.error("Transaction not found! Are you sure this is the correct network?");
    return;
  }

  console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
  console.log("Block Number:", receipt.blockNumber);
  console.log("From:", tx.from);
  console.log("To:", tx.to);

  console.log("\n--- Logs ---");
  for (const log of receipt.logs) {
    try {
      // Try to find the contract name if possible, or just print address
      console.log(`Log from: ${log.address}`);
      console.log(`   Topics: ${JSON.stringify(log.topics)}`);
      console.log(`   Data: ${log.data}`);
    } catch (e) {
      console.log(`Error parsing log: ${e.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
