import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createOfferingBrain,
  getActiveBrain,
  setOfferingBrainActive,
  deleteOfferingBrain,
  getBrainHistory,
  getOfferingBrainById,
  updateOfferingBrain,
} from "./db";

// Mock database module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    createOfferingBrain: vi.fn(),
    getActiveBrain: vi.fn(),
    setOfferingBrainActive: vi.fn(),
    deleteOfferingBrain: vi.fn(),
    getBrainHistory: vi.fn(),
    getOfferingBrainById: vi.fn(),
    updateOfferingBrain: vi.fn(),
  };
});

describe("Brain Management", () => {
  const mockUserId = 1;
  const mockBrainId = 100;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOfferingBrain", () => {
    it("should create a new brain with isActive=1 and deactivate others", async () => {
      vi.mocked(createOfferingBrain).mockResolvedValue(mockBrainId);

      const result = await createOfferingBrain({
        userId: mockUserId,
        brainName: "Test Brain",
        companyName: "Test Company",
        companyWebsite: "https://test.com",
        status: "completed",
      });

      expect(result).toBe(mockBrainId);
      expect(createOfferingBrain).toHaveBeenCalledWith({
        userId: mockUserId,
        brainName: "Test Brain",
        companyName: "Test Company",
        companyWebsite: "https://test.com",
        status: "completed",
      });
    });
  });

  describe("getActiveBrain", () => {
    it("should return the active brain for a user", async () => {
      const mockBrain = {
        id: mockBrainId,
        userId: mockUserId,
        brainName: "Active Brain",
        companyName: "Test Company",
        companyWebsite: "https://test.com",
        isActive: 1,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getActiveBrain).mockResolvedValue(mockBrain);

      const result = await getActiveBrain(mockUserId);

      expect(result).toEqual(mockBrain);
      expect(result?.isActive).toBe(1);
      expect(getActiveBrain).toHaveBeenCalledWith(mockUserId);
    });

    it("should return null when no active brain exists", async () => {
      vi.mocked(getActiveBrain).mockResolvedValue(null);

      const result = await getActiveBrain(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe("setOfferingBrainActive", () => {
    it("should activate a brain and deactivate others", async () => {
      vi.mocked(setOfferingBrainActive).mockResolvedValue(undefined);

      await setOfferingBrainActive(mockUserId, mockBrainId);

      expect(setOfferingBrainActive).toHaveBeenCalledWith(mockUserId, mockBrainId);
    });

    it("should handle activation of non-existent brain", async () => {
      vi.mocked(setOfferingBrainActive).mockRejectedValue(new Error("Brain not found"));

      await expect(setOfferingBrainActive(mockUserId, 999)).rejects.toThrow("Brain not found");
    });
  });

  describe("deleteOfferingBrain", () => {
    it("should delete a non-active brain", async () => {
      vi.mocked(deleteOfferingBrain).mockResolvedValue(undefined);

      await deleteOfferingBrain(mockBrainId);

      expect(deleteOfferingBrain).toHaveBeenCalledWith(mockBrainId);
    });

    it("should prevent deletion of active brain", async () => {
      vi.mocked(deleteOfferingBrain).mockRejectedValue(new Error("Cannot delete active brain"));

      await expect(deleteOfferingBrain(mockBrainId)).rejects.toThrow("Cannot delete active brain");
    });
  });

  describe("getBrainHistory", () => {
    it("should return all brains for a user", async () => {
      const mockHistory = [
        {
          id: 1,
          userId: mockUserId,
          brainName: "Brain 1",
          companyName: "Company 1",
          companyWebsite: "https://company1.com",
          isActive: 1,
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: mockUserId,
          brainName: "Brain 2",
          companyName: "Company 2",
          companyWebsite: "https://company2.com",
          isActive: 0,
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(getBrainHistory).mockResolvedValue(mockHistory);

      const result = await getBrainHistory(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(1);
      expect(result[1].isActive).toBe(0);
    });

    it("should return empty array when user has no brains", async () => {
      vi.mocked(getBrainHistory).mockResolvedValue([]);

      const result = await getBrainHistory(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe("getOfferingBrainById", () => {
    it("should return a brain by ID", async () => {
      const mockBrain = {
        id: mockBrainId,
        userId: mockUserId,
        brainName: "Test Brain",
        companyName: "Test Company",
        companyWebsite: "https://test.com",
        isActive: 1,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getOfferingBrainById).mockResolvedValue(mockBrain);

      const result = await getOfferingBrainById(mockBrainId);

      expect(result).toEqual(mockBrain);
      expect(result?.id).toBe(mockBrainId);
    });

    it("should return null when brain does not exist", async () => {
      vi.mocked(getOfferingBrainById).mockResolvedValue(null);

      const result = await getOfferingBrainById(999);

      expect(result).toBeNull();
    });
  });

  describe("updateOfferingBrain", () => {
    it("should update brain fields", async () => {
      vi.mocked(updateOfferingBrain).mockResolvedValue(undefined);

      await updateOfferingBrain(mockBrainId, {
        brainName: "Updated Brain Name",
        offeringSummary: "Updated summary",
      });

      expect(updateOfferingBrain).toHaveBeenCalledWith(mockBrainId, {
        brainName: "Updated Brain Name",
        offeringSummary: "Updated summary",
      });
    });

    it("should handle update of non-existent brain", async () => {
      vi.mocked(updateOfferingBrain).mockRejectedValue(new Error("Brain not found"));

      await expect(
        updateOfferingBrain(999, { brainName: "New Name" })
      ).rejects.toThrow("Brain not found");
    });
  });

  describe("Brain Workflow Integration", () => {
    it("should create brain, activate it, then create another and auto-activate", async () => {
      // Create first brain
      vi.mocked(createOfferingBrain).mockResolvedValueOnce(1);
      const brain1Id = await createOfferingBrain({
        userId: mockUserId,
        brainName: "Brain 1",
        companyName: "Company 1",
        companyWebsite: "https://company1.com",
        status: "completed",
      });

      expect(brain1Id).toBe(1);

      // Get active brain (should be brain 1)
      vi.mocked(getActiveBrain).mockResolvedValueOnce({
        id: 1,
        userId: mockUserId,
        brainName: "Brain 1",
        companyName: "Company 1",
        companyWebsite: "https://company1.com",
        isActive: 1,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const activeBrain = await getActiveBrain(mockUserId);
      expect(activeBrain?.id).toBe(1);

      // Create second brain (should auto-deactivate brain 1)
      vi.mocked(createOfferingBrain).mockResolvedValueOnce(2);
      const brain2Id = await createOfferingBrain({
        userId: mockUserId,
        brainName: "Brain 2",
        companyName: "Company 2",
        companyWebsite: "https://company2.com",
        status: "completed",
      });

      expect(brain2Id).toBe(2);

      // Get active brain (should now be brain 2)
      vi.mocked(getActiveBrain).mockResolvedValueOnce({
        id: 2,
        userId: mockUserId,
        brainName: "Brain 2",
        companyName: "Company 2",
        companyWebsite: "https://company2.com",
        isActive: 1,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newActiveBrain = await getActiveBrain(mockUserId);
      expect(newActiveBrain?.id).toBe(2);
    });

    it("should manually switch active brain", async () => {
      // Set brain 1 as active
      vi.mocked(setOfferingBrainActive).mockResolvedValue(undefined);
      await setOfferingBrainActive(mockUserId, 1);

      // Verify brain 1 is active
      vi.mocked(getActiveBrain).mockResolvedValueOnce({
        id: 1,
        userId: mockUserId,
        brainName: "Brain 1",
        companyName: "Company 1",
        companyWebsite: "https://company1.com",
        isActive: 1,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const activeBrain = await getActiveBrain(mockUserId);
      expect(activeBrain?.id).toBe(1);
    });
  });
});
