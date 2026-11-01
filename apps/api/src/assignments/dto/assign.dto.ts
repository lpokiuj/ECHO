import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsUUID,
  isUUID,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const NOTES_MAX_LENGTH = 1000;

// notes is a map { [userId]: string }: keys are UUIDs that appear in userIds,
// values are strings of at most NOTES_MAX_LENGTH characters.
@ValidatorConstraint({ name: 'assignNotes', async: false })
class AssignNotesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const userIds = (args.object as AssignDto).userIds;
    const allowed = new Set(Array.isArray(userIds) ? userIds : []);
    return Object.entries(value).every(
      ([key, note]) =>
        isUUID(key) &&
        allowed.has(key) &&
        typeof note === 'string' &&
        note.length <= NOTES_MAX_LENGTH,
    );
  }

  defaultMessage(): string {
    return `notes must map userIds from this request to strings of at most ${NOTES_MAX_LENGTH} characters`;
  }
}

export class AssignDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  userIds: string[];

  // Only `undefined` skips validation; null is rejected
  @ValidateIf((o: AssignDto) => o.notes !== undefined)
  @IsObject()
  @Validate(AssignNotesConstraint)
  notes?: Record<string, string>;
}
