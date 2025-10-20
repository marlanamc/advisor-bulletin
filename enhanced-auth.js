// Enhanced Authentication System for EBHCS Bulletin Board
class EnhancedAuth {
    constructor() {
        this.loginAttempts = {};
        this.maxAttempts = 5;
        this.lockoutTime = 15 * 60 * 1000; // 15 minutes
        this.passwordStrengthRegex = {
            weak: /^.{1,7}$/,
            medium: /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/,
            strong: /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/
        };
        this.init();
    }

    init() {
        this.bindAuthEvents();
        this.setupPasswordStrengthChecker();
        this.loadLoginAttempts();
    }

    bindAuthEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));

        // Password change form
        document.getElementById('passwordChangeForm').addEventListener('submit', (e) => this.handlePasswordChange(e));

        // Forgot password form
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => this.handleForgotPassword(e));

        // Forgot password button
        document.getElementById('forgotPasswordBtn').addEventListener('click', () => this.showForgotPassword());

        // Skip password change (temporary)
        document.getElementById('skipPasswordChange').addEventListener('click', () => this.skipPasswordChange());

        // Real-time password validation
        document.getElementById('newPassword').addEventListener('input', () => this.checkPasswordStrength());
        document.getElementById('confirmPassword').addEventListener('input', () => this.validatePasswordMatch());
    }

    async handleLogin(e) {
        e.preventDefault();

        const rawInput = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = document.getElementById('loginSubmitBtn');

        const parsed = this.parseLoginIdentifier(rawInput);
        if (parsed.error) {
            this.showError('loginError', parsed.error);
            return;
        }

        const { username, email } = parsed;

        // Check if user is locked out
        if (this.isUserLockedOut(username)) {
            this.showError('loginError', 'Too many failed attempts. Please try again in 15 minutes.');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = '';

        try {
            // Ensure Firebase auth is available
            if (typeof auth === 'undefined') {
                throw new Error('Firebase authentication not initialized');
            }
            await auth.signInWithEmailAndPassword(email, password);

            // Clear login attempts on successful login
            this.clearLoginAttempts(username);

            // Check if this is first login (password is still default)
            if (password === 'ebhcs123' && username !== 'admin') {
                // Set requirePasswordChange flag in Firestore
                try {
                    await db.collection('users').doc(username).set({
                        requirePasswordChange: true,
                        email: email,
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (error) {
                    console.error('Error setting password change flag:', error);
                }
                this.showPasswordChangeModal(username);
            } else {
                this.completeLogin(username, email);
            }

        } catch (error) {
            this.handleLoginError(error, username);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Login';
        }
    }

    handleLoginError(error, username) {
        this.recordFailedAttempt(username);

        let errorMessage;
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Username not found. Please check your username.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please wait before trying again.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled. Contact tech@ebhcs.org for help.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid username format.';
                break;
        default:
            errorMessage = 'Login failed. Please try again or contact support.';
            console.error('Login error:', error);
        }

        const attemptsLeft = this.maxAttempts - (this.loginAttempts[username]?.count || 0);
        if (attemptsLeft > 0 && attemptsLeft <= 3) {
            errorMessage += ` (${attemptsLeft} attempts remaining)`;
        }

        this.showError('loginError', errorMessage);
    }

    showPasswordChangeModal(username) {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('passwordChangeModal').style.display = 'block';
        document.getElementById('currentPassword').value = 'ebhcs123';
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const changeBtn = document.getElementById('changePasswordBtn');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            this.showError('passwordChangeError', 'New passwords do not match.');
            return;
        }

        // Validate password strength
        if (!this.isPasswordStrong(newPassword)) {
            this.showError('passwordChangeError', 'Password must be at least 8 characters with letters and numbers.');
            return;
        }

        // Show loading state
        changeBtn.disabled = true;
        changeBtn.classList.add('loading');
        changeBtn.textContent = '';

        try {
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

            // Re-authenticate user
            await user.reauthenticateWithCredential(credential);

            // Update password
            await user.updatePassword(newPassword);

            // Clear requirePasswordChange flag in Firestore
            const username = user.email.split('@')[0];
            try {
                await db.collection('users').doc(username).set({
                    requirePasswordChange: false,
                    passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (error) {
                console.error('Error clearing password change flag:', error);
            }

            this.showSuccess('Password changed successfully!');

            setTimeout(() => {
                document.getElementById('passwordChangeModal').style.display = 'none';
                this.completeLogin(username, user.email);
            }, 1500);

        } catch (error) {
            let errorMessage;
            switch (error.code) {
                case 'auth/wrong-password':
                    errorMessage = 'Current password is incorrect.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'New password is too weak. Please choose a stronger password.';
                    break;
                default:
                    errorMessage = 'Failed to change password. Please try again.';
                    console.error('Password change error:', error);
            }
            this.showError('passwordChangeError', errorMessage);
        } finally {
            // Reset button state
            changeBtn.disabled = false;
            changeBtn.classList.remove('loading');
            changeBtn.textContent = 'Change Password';
        }
    }

    skipPasswordChange() {
        if (confirm('Are you sure you want to skip changing your password? We recommend changing it for security.')) {
            const user = auth.currentUser;
            document.getElementById('passwordChangeModal').style.display = 'none';
            this.completeLogin(user.email.split('@')[0], user.email);
        }
    }

    completeLogin(username, email) {
        // Hide all modals
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('passwordChangeModal').style.display = 'none';

        // Set up admin panel
        const currentUser = {
            username: username,
            email: email,
            name: this.getUserDisplayName(username)
        };

        // Dispatch custom event for admin panel to handle
        document.dispatchEvent(new CustomEvent('userAuthenticated', {
            detail: currentUser
        }));
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const parsed = this.parseLoginIdentifier(document.getElementById('resetUsername').value);

        if (parsed.error) {
            this.showError('forgotPasswordError', parsed.error);
            return;
        }

        const { username, email } = parsed;

        try {
            // Use Firebase's built-in password reset email
            await firebase.auth().sendPasswordResetEmail(email);
            
            this.showMessage('forgotPasswordSuccess',
                `Password reset email sent to ${email}! Please check your inbox and spam folder. Click the link in the email to reset your password.`
            );
            
            // Close the modal after a short delay
            setTimeout(() => {
                this.closeForgotPassword();
            }, 3000);
            
        } catch (error) {
            console.error('Password reset error:', error);
            
            let errorMessage;
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many reset attempts. Please try again later.';
                    break;
                default:
                    errorMessage = 'Failed to send reset email. Please try again.';
            }
            
            this.showError('forgotPasswordError', errorMessage);
        }
    }

    sendPasswordResetNotification(username) {
        // Log the request for admin follow-up
        console.log(`Password reset requested for user: ${username}`);

        // In a real implementation, you might:
        // 1. Send email to admin
        // 2. Create a support ticket
        // 3. Generate temporary password
        // 4. Log security event
    }

    showForgotPassword() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('forgotPasswordModal').style.display = 'block';
    }

    closeForgotPassword() {
        document.getElementById('forgotPasswordModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'block';
    }

    // Password strength checking
    setupPasswordStrengthChecker() {
        // Real-time password strength feedback
        document.getElementById('newPassword').addEventListener('input', () => {
            this.checkPasswordStrength();
        });
    }

    checkPasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthDiv = document.getElementById('passwordStrength');

        if (!password) {
            strengthDiv.textContent = '';
            strengthDiv.className = 'password-strength';
            return;
        }

        let strength, message, className;

        if (this.passwordStrengthRegex.strong.test(password)) {
            strength = 'strong';
            message = '✅ Strong password';
            className = 'password-strength strong';
        } else if (this.passwordStrengthRegex.medium.test(password)) {
            strength = 'medium';
            message = '⚠️ Good password - consider adding special characters';
            className = 'password-strength medium';
        } else {
            strength = 'weak';
            message = '❌ Weak password - needs at least 8 characters with letters and numbers';
            className = 'password-strength weak';
        }

        strengthDiv.textContent = message;
        strengthDiv.className = className;
    }

    isPasswordStrong(password) {
        return this.passwordStrengthRegex.medium.test(password) || this.passwordStrengthRegex.strong.test(password);
    }

    validatePasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmInput = document.getElementById('confirmPassword');

        if (confirmPassword && newPassword !== confirmPassword) {
            confirmInput.setCustomValidity('Passwords do not match');
        } else {
            confirmInput.setCustomValidity('');
        }
    }

    parseLoginIdentifier(input) {
        const value = (input || '').trim().toLowerCase();

        if (!value) {
            return { error: 'Please enter your username or @ebhcs.org email.' };
        }

        if (value.includes('@')) {
            const parts = value.split('@');
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
                return { error: 'Invalid username format.' };
            }

            const [name, domain] = parts;
            if (domain !== 'ebhcs.org') {
                return { error: 'Please use your @ebhcs.org advisor email.' };
            }

            return {
                username: name,
                email: `${name}@${domain}`
            };
        }

        if (!/^[a-z0-9._-]+$/.test(value)) {
            return { error: 'Usernames may include letters, numbers, periods, and hyphens.' };
        }

        const username = value;
        const email = username === 'admin' ? 'admin@ebhcs.org' : `${username}@ebhcs.org`;

        return { username, email };
    }

    // Login attempt tracking
    isUserLockedOut(username) {
        const attempts = this.loginAttempts[username];
        if (!attempts) return false;

        const now = Date.now();
        if (attempts.count >= this.maxAttempts) {
            if (now - attempts.lastAttempt < this.lockoutTime) {
                return true;
            } else {
                // Lockout period expired, reset attempts
                delete this.loginAttempts[username];
                this.saveLoginAttempts();
                return false;
            }
        }
        return false;
    }

    recordFailedAttempt(username) {
        if (!this.loginAttempts[username]) {
            this.loginAttempts[username] = { count: 0, lastAttempt: 0 };
        }

        this.loginAttempts[username].count++;
        this.loginAttempts[username].lastAttempt = Date.now();
        this.saveLoginAttempts();
    }

    clearLoginAttempts(username) {
        delete this.loginAttempts[username];
        this.saveLoginAttempts();
    }

    clearAllLoginAttempts() {
        this.loginAttempts = {};
        this.saveLoginAttempts();
        console.log('All login attempts cleared');
    }

    loadLoginAttempts() {
        try {
            const saved = localStorage.getItem('ebhcs_login_attempts');
            this.loginAttempts = saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading login attempts:', error);
            this.loginAttempts = {};
        }
    }

    saveLoginAttempts() {
        try {
            localStorage.setItem('ebhcs_login_attempts', JSON.stringify(this.loginAttempts));
        } catch (error) {
            console.error('Error saving login attempts:', error);
        }
    }

    // Utility methods
    getUserDisplayName(username) {
        const names = {
            'admin': 'Administrator',
            'jorge': 'Jorge',
            'fabiola': 'Fabiola',
            'leidy': 'Leidy',
            'carmen': 'Carmen',
            'jerome': 'Jerome',
            'felipe': 'Felipe',
            'simonetta': 'Simonetta',
            'mike': 'Mike K.',
            'leah': 'Leah'
        };
        return names[username] || username;
    }

    showError(elementId, message) {
        const errorDiv = document.getElementById(elementId);
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Hide success message if showing
        const successDiv = document.getElementById(elementId.replace('Error', 'Success'));
        if (successDiv) successDiv.style.display = 'none';
    }

    showMessage(elementId, message) {
        const messageDiv = document.getElementById(elementId);
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';

        // Hide error message if showing
        const errorDiv = document.getElementById(elementId.replace('Success', 'Error'));
        if (errorDiv) errorDiv.style.display = 'none';
    }

    showSuccess(message) {
        // Show temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 1001;
            font-weight: 500;
        `;
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

// Global utility functions
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.nextElementSibling;

    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = '🙈';
    } else {
        field.type = 'password';
        button.textContent = '👁️';
    }
}

function closeForgotPassword() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
    document.getElementById('loginModal').style.display = 'block';
}

// Initialize enhanced authentication
let enhancedAuth;
document.addEventListener('DOMContentLoaded', () => {
    enhancedAuth = new EnhancedAuth();
});

// Expose for global access
window.enhancedAuth = enhancedAuth;

// Global function to clear lockout (for debugging)
window.clearLoginLockout = function() {
    if (window.enhancedAuth) {
        window.enhancedAuth.clearAllLoginAttempts();
        location.reload();
    }
};
