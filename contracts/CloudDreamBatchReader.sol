// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CloudDreamBatchReader
 * @notice 独立的批量查询合约，用于优化前端数据加载
 * @dev 只读合约，不修改任何状态，零风险升级
 */
contract CloudDreamBatchReader {
    // --- 数据结构 (与 Core 保持一致) ---
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
    address public immutable core;

    constructor(address _core) {
        require(_core != address(0), unicode"无效的 Core 地址");
        core = _core;
    }

    // === 批量查询函数 ===

    /// @notice 获取用户祈愿记录数量
    function getUserWishCount(address user) external view returns (uint256) {
        // 通过遍历来获取数量（因为原合约没有 count 函数）
        uint256 count = 0;
        while (true) {
            try ICore(core).userWishIds(user, count) returns (uint256) {
                count++;
            } catch {
                break;
            }
            if (count > 10000) break; // 安全限制
        }
        return count;
    }

    /// @notice 批量获取用户祈愿 ID（分页）
    function getUserWishIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](count);
        uint256 fetched = 0;
        
        for (uint256 i = 0; i < count; i++) {
            try ICore(core).userWishIds(user, start + i) returns (uint256 id) {
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
        uint256[] memory ids = ICore(core).getUserPityIds(user);
        return ids.length;
    }

    /// @notice 批量获取用户天道回响 ID（分页）
    function getUserPityIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] memory allIds = ICore(core).getUserPityIds(user);
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
            ) = ICore(core).allWishes(ids[i]);
            
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
            ) = ICore(core).allPityRecords(ids[i]);
            
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
        uint256[] memory ids = new uint256[](maxCount);
        uint256 count = 0;
        
        for (uint256 i = 0; i < maxCount; i++) {
            try ICore(core).userWishIds(user, i) returns (uint256 id) {
                ids[count] = id;
                count++;
            } catch {
                break;
            }
        }
        
        // 获取详情
        WishRecord[] memory result = new WishRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            (
                uint256 id,
                address u,
                string memory wishText,
                uint256 timestamp,
                uint256 round,
                uint8 tier,
                uint256 reward
            ) = ICore(core).allWishes(ids[i]);
            
            result[i] = WishRecord({
                id: id,
                user: u,
                wishText: wishText,
                timestamp: timestamp,
                round: round,
                tier: tier,
                reward: reward
            });
        }
        return result;
    }
}

// --- 核心合约接口 ---
interface ICore {
    function userWishIds(address user, uint256 index) external view returns (uint256);
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
    function allPityRecords(uint256 id) external view returns (
        uint256 id_,
        address user,
        uint256 amount,
        uint256 timestamp
    );
}
