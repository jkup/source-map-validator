export abstract class ValidationResult {
    static from(errors: Error[]): ValidationResult {
        return errors.length > 0 ? ValidationFail.from(errors) : ValidationSuccess.create();
    }
}

export class ValidationSuccess {
    private static INSTANCE = new ValidationSuccess();

    static create() {
        return this.INSTANCE;
    }

    private constructor() {}
}

export class ValidationFail {
    static from(errors: Error[]) {
        return new ValidationFail(errors);
    }

    private constructor(public readonly errors: Error[]) {}
}