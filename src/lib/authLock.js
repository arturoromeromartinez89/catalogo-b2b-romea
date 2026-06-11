// Mutex global que impide que AuthGate reaccione a eventos de auth mientras
// el admin crea una cuenta de cliente (signUp cambia la sesión temporalmente).
let _locked = false;
export const lockAuth   = () => { _locked = true; };
export const unlockAuth = () => { _locked = false; };
export const isAuthLocked = () => _locked;
