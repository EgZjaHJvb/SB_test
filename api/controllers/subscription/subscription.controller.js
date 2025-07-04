import stripe from '../../config/stripe.js';
import Subscription from '../../models/subscription/subscription.model.js';
import User from '../../models/auth/User.model.js';

export const createCheckoutSession = async (req, res) => {
    const user = req.user;
    const { priceId } = req.body;

    const priceIdToPlanType = {
        price_1RXzaURuy5tVrq8wyqmJKJKo: 'pro',
        price_1Rc6H2Ruy5tVrq8wJBjsDsDl: 'enterprise',
    };

    try {
        let subscriptionDoc = null;

        if (user.currentSubscription) {
            subscriptionDoc = await Subscription.findById(user.currentSubscription);
        }

        let customerId;
        if (subscriptionDoc && subscriptionDoc.stripeCustomerId) {
            customerId = subscriptionDoc.stripeCustomerId;
        } else {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: user._id.toString() },
            });
            customerId = customer.id;

            const planType = priceIdToPlanType[priceId] || 'pro';

            subscriptionDoc = new Subscription({
                user: user._id,
                type: planType,
                status: 'inactive',
                stripeCustomerId: customerId,
            });
            await subscriptionDoc.save();

            await User.findByIdAndUpdate(user._id, {
                currentSubscription: subscriptionDoc._id,
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.FRONTEND_ORIGIN}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_ORIGIN}/dashboard/price`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

export const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const customerId = session.customer;

        const subscriptionDoc = await Subscription.findOne({ stripeCustomerId: customerId });
        if (subscriptionDoc) {
            subscriptionDoc.status = 'active';
            subscriptionDoc.stripeSubscriptionId = session.subscription;
            subscriptionDoc.planStart = new Date(); // optional
            await subscriptionDoc.save();
        }
    }

    res.status(200).send('Webhook received');
};

export const verifySession = async (req, res) => {
    const { sessionId } = req.body;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        await Subscription.findOneAndUpdate(
            { stripeCustomerId: session.customer },
            {
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                planStart: new Date(subscription.start_date * 1000),
                planEnd: new Date(subscription.current_period_end * 1000),
            },
            { new: true }
        );

        const updated = await Subscription.findOne({ stripeSubscriptionId: subscription.id });

        res.json({ subscription: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to verify session' });
    }
};

export const getCurrentSubscriptionStatus = async (req, res) => {
    try {
        const user = req.user;
        const subscription = await Subscription.findById(user.currentSubscription);
        res.json({ subscription });
    } catch (err) {
        console.error('Failed to get subscription:', err);
        res.status(500).json({ error: 'Could not fetch subscription' });
    }
};

export const getSubscriptionStatusByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let subscription = null;
        if (user.currentSubscription) {
            subscription = await Subscription.findById(user.currentSubscription);
        }
        
        // If no subscription found, return default free subscription
        if (!subscription) {
            subscription = { type: 'free', status: 'active' };
        }
        
        res.json({ subscription });
    } catch (err) {
        console.error('Failed to get subscription by user ID:', err);
        res.status(500).json({ error: 'Could not fetch subscription' });
    }
};
