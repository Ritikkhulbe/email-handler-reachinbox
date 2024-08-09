import { AxiosRequestConfig } from 'axios';

export const createConfig = (url: string, accessToken: string): AxiosRequestConfig => {
    return {
        method: 'GET',
        url: url.toString(),
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
};
