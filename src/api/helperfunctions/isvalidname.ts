/*
    This function checks if a given name is valid. A valid name contains only letters, digits, spaces, and basic keyboard symbols.
    It returns true if the name is valid, and false otherwise.
*/
export function isValidName(name: string): boolean {
    // Allow letters, digits, spaces, and basic keyboard symbols
    const regex = /^[a-zA-Z0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]*$/;
    return regex.test(name);
}