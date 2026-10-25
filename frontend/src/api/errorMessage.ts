import axios from "axios";

export function getErrorMessage(error: unknown, genericMessage: string): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const serverMessage: string | undefined = error.response?.data?.message;

        if (status !== undefined && status < 500 && serverMessage) {
            return serverMessage;
        }
    }
    return genericMessage;
}

export function getErrorStatus(error: unknown): number | undefined {
    return axios.isAxiosError(error) ? error.response?.status : undefined;
}
