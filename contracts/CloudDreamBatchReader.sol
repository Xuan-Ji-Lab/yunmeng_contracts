// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CloudDreamBatchReader
 * @notice 独立的批量查询合约，用于优化前端数据加载
 * @dev 只读合约，不修改任何状态，零风险升级
 */
contract CloudDreamBatchReader {
    // --- 数据结构 (与 Seeker 保持一致) ---
    struct WishRecord {
        uint256 id;
        address user;
        string wishText;
        uint256 timestamp;
        uint256 round;
        uint8 tier;
        uint256 reward;
    }

    struct PityRecord {
        uint256 id;
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    // --- 核心合约接口 ---
    address public immutable seeker;
    address public immutable oracle;

    constructor(address _seeker, address _oracle) {
        require(_seeker != address(0), unicode"无效的 Seeker 地址");
        seeker = _seeker;
        oracle = _oracle;
    }

    // === 批量查询函数 ===

    /// @notice 获取用户祈愿记录数量
    function getUserWishCount(address user) external view returns (uint256) {
        // 通过遍历来获取数量（因为原合约没有 count 函数，或者只有 getUserWishCount view）
        // DreamSeeker 有 getUserWishCount 试图函数吗？
        // 检查 ISeeker 接口定义。如果有 getUserWishCount 则直接调用。
        // 如果没有，则使用 try-catch 遍历。
        // DreamSeeker (Proxy) 代码中有 getUserWishCount。
        try ISeeker(seeker).getUserWishCount(user) returns (uint256 count) {
            return count;
        } catch {
            // Fallback: 遍历
            uint256 count = 0;
            while (true) {
                try ISeeker(seeker).userWishIds(user, count) returns (uint256) {
                    count++;
                } catch {
                    break;
                }
                if (count > 10000) break; // 安全限制
            }
            return count;
        }
    }

    /// @notice 批量获取用户祈愿 ID（分页）
    function getUserWishIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        // 如果 Seeker 提供了 batch getter，优先使用
        try ISeeker(seeker).getUserWishIdsBatch(user, start, count) returns (uint256[] memory ids) {
            return ids;
        } catch {
           // Fallback
        }

        uint256[] memory result = new uint256[](count);
        uint256 fetched = 0;
        
        for (uint256 i = 0; i < count; i++) {
            try ISeeker(seeker).userWishIds(user, start + i) returns (uint256 id) {
                result[fetched] = id;
                fetched++;
            } catch {
                break;
            }
        }
        
        // 截断到实际数量
        if (fetched < count) {
            uint256[] memory trimmed = new uint256[](fetched);
            for (uint256 i = 0; i < fetched; i++) {
                trimmed[i] = result[i];
            }
            return trimmed;
        }
        return result;
    }

    /// @notice 获取用户天道回响记录数量
    function getUserPityCount(address user) external view returns (uint256) {
        uint256[] memory ids = ISeeker(seeker).getUserPityIds(user);
        return ids.length;
    }

    /// @notice 批量获取用户天道回响 ID（分页）
    function getUserPityIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] memory allIds = ISeeker(seeker).getUserPityIds(user);
        uint256 total = allIds.length;
        
        if (start >= total) {
            return new uint256[](0);
        }
        
        uint256 end = start + count;
        if (end > total) {
            end = total;
        }
        
        uint256 resultLength = end - start;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allIds[start + i];
        }
        return result;
    }

    /// @notice 批量获取祈愿记录详情
    function getWishRecordsBatch(uint256[] calldata ids) external view returns (WishRecord[] memory) {
        // 如果 Seeker 提供了 batch getter
        try ISeeker(seeker).getWishRecordsBatch(ids) returns (WishRecord[] memory records) {
            return records;
        } catch {
            // Fallback
        }

        uint256 len = ids.length;
        WishRecord[] memory result = new WishRecord[](len);
        
        for (uint256 i = 0; i < len; i++) {
            (
                uint256 id,
                address user,
                string memory wishText,
                uint256 timestamp,
                uint256 round,
                uint8 tier,
                uint256 reward
            ) = ISeeker(seeker).allWishes(ids[i]);
            
            result[i] = WishRecord({
                id: id,
                user: user,
                wishText: wishText,
                timestamp: timestamp,
                round: round,
                tier: tier,
                reward: reward
            });
        }
        return result;
    }

    /// @notice 批量获取天道回响记录详情
    function getPityRecordsBatch(uint256[] calldata ids) external view returns (PityRecord[] memory) {
        uint256 len = ids.length;
        PityRecord[] memory result = new PityRecord[](len);
        
        for (uint256 i = 0; i < len; i++) {
            (
                uint256 id,
                address user,
                uint256 amount,
                uint256 timestamp
            ) = ISeeker(seeker).allPityRecords(ids[i]);
            
            result[i] = PityRecord({
                id: id,
                user: user,
                amount: amount,
                timestamp: timestamp
            });
        }
        return result;
    }

    /// @notice 一次性获取用户所有祈愿数据（适合数量较少时）
    function getUserWishRecordsAll(address user, uint256 maxCount) external view returns (WishRecord[] memory) {
        // 先获取 ID 列表
        uint256[] memory ids;
        try ISeeker(seeker).getUserWishIdsBatch(user, 0, maxCount) returns (uint256[] memory _ids) {
            ids = _ids;
        } catch {
             // Fallback ID fetch if batch not available
             // ... simplify for readability, assume Seeker has standard access or we use the loop method above
             ids = this.getUserWishIdsBatch(user, 0, maxCount); // external call to self? inefficient but works for view
        }
        
        // 获取详情
        // Use batch getter if available?
        return this.getWishRecordsBatch(ids);
    }

    // === Oracle 批量查询 ===

    struct TopicBetRecord {
        bytes32 topicId;
        uint256[2] amounts; // [OptionA, OptionB]
        bool claimed;
    }

    /// @notice 批量获取用户在特定议题的下注情况
    function getUserTopicBets(address user, bytes32[] calldata topicIds) external view returns (TopicBetRecord[] memory) {
        uint256 len = topicIds.length;
        TopicBetRecord[] memory result = new TopicBetRecord[](len);
        
        for (uint256 i = 0; i < len; i++) {
            bytes32 tid = topicIds[i];
            
            // 下注金额
            uint256 amtA = IOracle(oracle).userBets(tid, user, 0);
            uint256 amtB = IOracle(oracle).userBets(tid, user, 1);
            
            // 领奖状态
            bool clm = IOracle(oracle).hasClaimed(tid, user);
            
            result[i] = TopicBetRecord({
                topicId: tid,
                amounts: [amtA, amtB],
                claimed: clm
            });
        }
        return result;
    }

    struct TopicBetDetail {
        address user;
        uint256 amountA;
        uint256 amountB;
        bool claimed;
    }

    /// @notice 获取某个议题的所有下注详情
    function getTopicBetsDetails(bytes32 topicId) external view returns (TopicBetDetail[] memory) {
        address[] memory users = IOracle(oracle).getTopicParticipants(topicId);
        uint256 len = users.length;
        TopicBetDetail[] memory result = new TopicBetDetail[](len);

        for (uint256 i = 0; i < len; i++) {
            address u = users[i];
            uint256 amtA = IOracle(oracle).userBets(topicId, u, 0);
            uint256 amtB = IOracle(oracle).userBets(topicId, u, 1);
            bool clm = IOracle(oracle).hasClaimed(topicId, u);

            result[i] = TopicBetDetail({
                user: u,
                amountA: amtA,
                amountB: amtB,
                claimed: clm
            });
        }
        return result;
    }
}

interface IOracle {
    function userBets(bytes32 topicId, address user, uint256 option) external view returns (uint256);
    function hasClaimed(bytes32 topicId, address user) external view returns (bool);
    function getTopicParticipants(bytes32 topicId) external view returns (address[] memory);
}

// --- 核心合约接口 (Seeker) ---
interface ISeeker {
    function userWishIds(address user, uint256 index) external view returns (uint256);
    function getUserWishCount(address user) external view returns (uint256);
    function getUserWishIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory);
    
    function getUserPityIds(address user) external view returns (uint256[] memory);
    
    function allWishes(uint256 id) external view returns (
        uint256 id_,
        address user,
        string memory wishText,
        uint256 timestamp,
        uint256 round,
        uint8 tier,
        uint256 reward
    );
    function getWishRecordsBatch(uint256[] calldata ids) external view returns (CloudDreamBatchReader.WishRecord[] memory);
    
    function allPityRecords(uint256 id) external view returns (
        uint256 id_,
        address user,
        uint256 amount,
        uint256 timestamp
    );
}

