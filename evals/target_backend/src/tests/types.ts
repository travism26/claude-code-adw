import '@types/jest';
import { Model } from 'sequelize';

// Extend Plant model to include associations
declare module '../models/Plant' {
  interface Plant extends Model {
    owner?: import('../models/User').User;
  }
}

// Extend JournalEntry model to include associations
declare module '../models/JournalEntry' {
  interface JournalEntry extends Model {
    plant?: import('../models/Plant').Plant;
  }
}
