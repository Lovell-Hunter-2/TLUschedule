import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Đã có lỗi xảy ra</h2>
            <p className="text-gray-600 mb-4">Vui lòng tải lại trang hoặc liên hệ hỗ trợ.</p>
            <pre className="bg-gray-100 p-4 rounded-lg text-xs text-gray-800 overflow-auto max-h-40 whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
