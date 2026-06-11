/**
 * Copy every prototype method from a method-holder class onto the target
 * class. Lets a large class live across several files without changing any
 * call sites ("this." keeps working). Used by firebase-config.js and
 * firebase-admin.js to assemble their main classes from src/ modules.
 */
export function applyMethods(targetClass, mixinClass) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(mixinClass.prototype))) {
        if (name !== 'constructor') {
            Object.defineProperty(targetClass.prototype, name, descriptor);
        }
    }
}
