import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Any throw during render escaped to the root and left a blank page: a route
 * with no boundary is indistinguishable from an empty document to whoever hit
 * it. Catches render-time errors only, which is what a class component can do.
 */
class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Unhandled render error:", error, info.componentStack)
    }

    render() {
        if (!this.state.error) return this.props.children
        return (
            <main className="standard-layout">
                <h1>Something broke</h1>
                <p>This page hit an error and was stopped before it could finish loading.</p>
                <button type="button" onClick={() => this.setState({ error: null })}>
                    Try again
                </button>
                <button type="button" onClick={() => window.location.assign("/")}>
                    Go home
                </button>
            </main>
        )
    }
}

export default ErrorBoundary