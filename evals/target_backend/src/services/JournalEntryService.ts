import { JournalEntry, Plant } from '../models';

/**
 * JournalEntryService - Encapsulates all JournalEntry model operations
 */
export const JournalEntryService = {
  /**
   * Create a new journal entry
   */
  async create(data: {
    plant_id: string;
    note?: string;
    photo_url?: string;
  }): Promise<JournalEntry> {
    return JournalEntry.create(data);
  },

  /**
   * Find all journal entries for a plant
   */
  async findByPlantId(plantId: string): Promise<JournalEntry[]> {
    return JournalEntry.findAll({
      where: { plant_id: plantId },
      order: [['entry_ts', 'DESC']],
    });
  },

  /**
   * Find a journal entry by ID with plant verification
   */
  async findByIdWithPlant(id: string, userId: string): Promise<JournalEntry | null> {
    return JournalEntry.findOne({
      where: { id },
      include: [
        {
          model: Plant,
          as: 'plant',
          where: { user_id: userId },
          required: true,
        },
      ],
    });
  },

  /**
   * Update a journal entry
   */
  async update(entry: JournalEntry, data: Partial<{
    note: string;
    photo_url: string;
  }>): Promise<JournalEntry> {
    await entry.update(data);
    return entry;
  },

  /**
   * Delete a journal entry
   */
  async delete(entry: JournalEntry): Promise<void> {
    await entry.destroy();
  },

  /**
   * Check if a plant belongs to a user (for ownership verification)
   */
  async verifyPlantOwnership(plantId: string, userId: string): Promise<Plant | null> {
    // UUID validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plantId)) {
      return null;
    }

    return Plant.findOne({
      where: {
        id: plantId,
        user_id: userId,
      },
    });
  },
};
