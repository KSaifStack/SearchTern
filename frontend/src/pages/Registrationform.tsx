import { useState } from "react";

type StrengthLevel = {
    width: string;
    color: string;
    label: string;
};

const getStrength = (val: string): StrengthLevel => {
    if (!val) return { width: "0%", color: "transparent", label: "Enter a password to check strength" };
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels: StrengthLevel[] = [
        { width: "20%", color: "#E24B4A", label: "Too weak" },
        { width: "45%", color: "#EF9F27", label: "Weak" },
        { width: "70%", color: "#639922", label: "Good" },
        { width: "100%", color: "var(--accent-color)", label: "Strong" },
    ];
    return levels[score - 1] ?? levels[0];
};

// SVG eye icons — no emoji
const EyeOpen = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export default function RegistrationForm() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmError, setConfirmError] = useState(false);

    const strength = getStrength(password);

    const handleSubmit = () => {
        if (password && password !== confirmPassword) {
            setConfirmError(true);
            setTimeout(() => setConfirmError(false), 1500);
            return;
        }
        alert("Account created successfully!");
    };

    return (
        <div style={styles.wrap}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.heading}>Create your account</h1>
                <p style={styles.subheading}>Fill in the details below to get started.</p>
            </div>

            {/* Body */}
            <div style={styles.body}>

                {/* Name row */}
                <div style={styles.fieldRow}>
                    <Field label="First name">
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            style={styles.input}
                        />
                    </Field>
                    <Field label="Last name">
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            style={styles.input}
                        />
                    </Field>
                </div>

                {/* Username */}
                <Field label="Username">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        style={{
                            ...styles.input,
                            borderColor: username.length > 2 ? "var(--accent-color)" : undefined,
                        }}
                    />
                </Field>

                {/* Email */}
                <Field label="Email address">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        style={styles.input}
                    />
                </Field>

                {/* DOB + Gender row */}
                <div style={styles.fieldRow}>
                    <Field label="Date of birth">
                        <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            autoComplete="bday"
                            style={styles.input}
                        />
                    </Field>
                    <Field label="Gender">
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            style={styles.input}
                        >
                            <option value="" disabled>Select</option>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Non-binary</option>
                            <option>Prefer not to say</option>
                        </select>
                    </Field>
                </div>

                {/* Divider */}
                <div style={styles.divider}>
                    <div style={styles.dividerLine} />
                    <span style={styles.dividerText}>account security</span>
                    <div style={styles.dividerLine} />
                </div>

                {/* Password */}
                <Field label="Password">
                    <div style={styles.passwordWrap}>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="pwd-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            style={{ ...styles.input, paddingRight: 40 }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            style={styles.eyeBtn}
                            aria-label="Toggle password visibility"
                        >
                            {showPassword ? <EyeOff /> : <EyeOpen />}
                        </button>
                    </div>
                    <div style={styles.strengthBar}>
                        <div
                            style={{
                                ...styles.strengthFill,
                                width: strength.width,
                                background: strength.color,
                            }}
                        />
                    </div>
                    <span style={styles.strengthLabel}>{strength.label}</span>
                </Field>

                {/* Confirm password */}
                <Field label="Confirm password">
                    <div style={styles.passwordWrap}>
                        <input
                            type={showConfirm ? "text" : "password"}
                            id="pwd-confirm"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            style={{
                                ...styles.input,
                                paddingRight: 40,
                                borderColor: confirmError ? "#E24B4A" : undefined,
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            style={styles.eyeBtn}
                            aria-label="Toggle confirm password visibility"
                        >
                            {showConfirm ? <EyeOff /> : <EyeOpen />}
                        </button>
                    </div>
                </Field>

                {/* Submit */}
                <button onClick={handleSubmit} style={styles.submitBtn}>
                    Create account
                </button>
            </div>

            {/* Footer */}
            <p style={styles.loginLink}>
                Already have an account?{" "}
                <a href="#" style={styles.loginAnchor}>
                    Sign in
                </a>
            </p>
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div style={styles.field}>
            <label style={styles.label}>{label}</label>
            {children}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrap: {
        fontFamily: "'Lexend', sans-serif",
        maxWidth: 520,
        margin: "2rem auto",
        background: "var(--feature-color)",
        border: "0.5px solid var(--border-medium)",
        borderRadius: 16,
        overflow: "hidden",
    },
    header: {
        padding: "2rem 2rem 1.5rem",
        borderBottom: "0.5px solid var(--border-light)",
    },
    heading: {
        fontFamily: "'Lexend', sans-serif",
        fontSize: 26,
        fontWeight: 600,
        margin: "0 0 4px",
        color: "var(--text-dark)",
    },
    subheading: {
        fontSize: 13,
        color: "var(--text-gray)",
        margin: 0,
        fontWeight: 300,
    },
    body: {
        padding: "1.5rem 2rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: 14,
    },
    fieldRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: 5,
    },
    label: {
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
    },
    input: {
        height: 40,
        padding: "0 12px",
        fontSize: 14,
        fontFamily: "'Lexend', sans-serif",
        borderRadius: 8,
        background: "var(--page-bg)",
        border: "0.5px solid var(--border-medium)",
        color: "var(--font-color)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        transition: "border-color 0.15s",
    },
    passwordWrap: {
        position: "relative",
    },
    eyeBtn: {
        position: "absolute",
        right: 10,
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        margin: 0,
        width: "auto",
    },
    strengthBar: {
        height: 3,
        borderRadius: 2,
        background: "var(--border-light)",
        marginTop: 6,
        overflow: "hidden",
    },
    strengthFill: {
        height: "100%",
        borderRadius: 2,
        transition: "width 0.3s, background 0.3s",
    },
    strengthLabel: {
        fontSize: 11,
        color: "var(--text-light)",
        marginTop: 3,
    },
    divider: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "4px 0",
    },
    dividerLine: {
        flex: 1,
        height: 0.5,
        background: "var(--border-light)",
    },
    dividerText: {
        fontSize: 11,
        color: "var(--text-light)",
        whiteSpace: "nowrap",
    },
    submitBtn: {
        width: "100%",
        height: 44,
        borderRadius: 8,
        background: "var(--button-color)",
        color: "#fff",
        fontFamily: "'Lexend', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        border: "none",
        cursor: "pointer",
        marginTop: 4,
        transition: "background-color 0.2s ease",
    },
    loginLink: {
        textAlign: "center",
        fontSize: 12,
        color: "var(--text-gray)",
        padding: "0 2rem 1.5rem",
    },
    loginAnchor: {
        color: "var(--accent-color)",
        textDecoration: "none",
        fontWeight: 500,
    },
};