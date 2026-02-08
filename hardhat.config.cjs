require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.22",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1
            }
        }
    },
    networks: {
        hardhat: {
            chainId: 1337,
            forking: {
                url: "https://data-seed-prebsc-2-s3.binance.org:8545/",
            }
        },
        bscTestnet: {
            url: "https://bsc-testnet.publicnode.com", // Use the one that works in frontend
            chainId: 97,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, '')}`]
                : [],
            gasPrice: 5000000000, // 5 gwei
        }
    },
    etherscan: {
        apiKey: {
            bscTestnet: process.env.BSCSCAN_API_KEY || ""
        }
    },
    // BSC 测试链 Chainlink VRF v2 配置 (供参考)
    // VRF Coordinator: 0x6A2AAd07396B36Fe02a22b33cf443582f682c82f
    // Key Hash: 0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314
    // LINK Token: 0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06
};
