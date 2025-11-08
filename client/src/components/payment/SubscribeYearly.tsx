import React, { useState } from 'react';
import { MoonLoader } from 'react-spinners';
import { useAuthStore } from '../../stores/useAuthStore';

export default function SubscribeYearly() {
    const { session, user } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        if (!user || !session) return alert('You must be logged in');

        setLoading(true);
        try {
            const FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
            const res = await fetch(`${FUNCTION_URL}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    userId: user.id,
                    priceId: 'price_1SRGXjBHWIp9OjfCQjL3kPcP',
                }),
            });

            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else console.error('No checkout URL returned', data);
        } catch (err) {
            console.error('Checkout session error', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button className="btn btn-subscribe" onClick={handleSubscribe} disabled={loading}>
            {loading ? <MoonLoader size={16} color="#fff" /> : 'Subscribe yearly for $26.88 (Save 25%)'}
        </button>
    );
}