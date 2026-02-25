const Analytics = require("../models/Analytics");

/**
 * @desc    Track a pageview or event (called from frontend)
 * @route   POST /api/analytics/track
 * @access  Public
 */
const trackEvent = async (req, res) => {
    try {
        const {
            sessionId,
            userId,
            page,
            referrer,
            entryPage,
            exitPage,
            deviceType,
            browser,
            os,
            screenResolution,
            timeSpent,
            sessionDuration,
            isBounce,
            eventType,
            metadata,
        } = req.body;

        if (!sessionId || !page) {
            return res.status(400).json({ message: "sessionId and page are required" });
        }

        const event = await Analytics.create({
            sessionId,
            userId: userId || null,
            page,
            referrer: referrer || "",
            entryPage: entryPage || page,
            exitPage: exitPage || "",
            deviceType: deviceType || "unknown",
            browser: browser || "",
            os: os || "",
            screenResolution: screenResolution || "",
            timeSpent: timeSpent || 0,
            sessionDuration: sessionDuration || 0,
            isBounce: isBounce || false,
            eventType: eventType || "pageview",
            metadata: metadata || {},
        });

        res.status(201).json({ success: true, id: event._id });
    } catch (error) {
        console.error("Track event error:", error.message);
        res.status(500).json({ message: "Server error tracking event" });
    }
};

/**
 * @desc    Batch track multiple events
 * @route   POST /api/analytics/track/batch
 * @access  Public
 */
const trackBatch = async (req, res) => {
    try {
        const { events } = req.body;

        if (!events || !Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ message: "events array is required" });
        }

        // Limit batch size
        const batchEvents = events.slice(0, 50);

        const docs = batchEvents.map((evt) => ({
            sessionId: evt.sessionId,
            userId: evt.userId || null,
            page: evt.page,
            referrer: evt.referrer || "",
            entryPage: evt.entryPage || evt.page,
            exitPage: evt.exitPage || "",
            deviceType: evt.deviceType || "unknown",
            browser: evt.browser || "",
            os: evt.os || "",
            screenResolution: evt.screenResolution || "",
            timeSpent: evt.timeSpent || 0,
            sessionDuration: evt.sessionDuration || 0,
            isBounce: evt.isBounce || false,
            eventType: evt.eventType || "pageview",
            metadata: evt.metadata || {},
        }));

        await Analytics.insertMany(docs);
        res.status(201).json({ success: true, count: docs.length });
    } catch (error) {
        console.error("Batch track error:", error.message);
        res.status(500).json({ message: "Server error batch tracking" });
    }
};

/**
 * @desc    Get analytics dashboard data (admin)
 * @route   GET /api/analytics/dashboard
 * @access  Private/Admin
 */
const getDashboard = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [
            totalPageviews,
            uniqueSessions,
            pageViewsByPage,
            deviceBreakdown,
            bounceData,
            topEntryPages,
            topExitPages,
            dailyPageviews,
            avgSessionDuration,
            browserBreakdown,
            osBreakdown,
            topButtonClicks,
        ] = await Promise.all([
            // Total pageviews
            Analytics.countDocuments({
                eventType: "pageview",
                createdAt: { $gte: startDate },
            }),

            // Unique sessions
            Analytics.distinct("sessionId", {
                createdAt: { $gte: startDate },
            }).then((sessions) => sessions.length),

            // Page views by page
            Analytics.aggregate([
                { $match: { eventType: "pageview", createdAt: { $gte: startDate } } },
                { $group: { _id: "$page", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),

            // Device breakdown
            Analytics.aggregate([
                { $match: { eventType: "pageview", createdAt: { $gte: startDate } } },
                { $group: { _id: "$deviceType", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // Bounce rate
            Analytics.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: "$sessionId",
                        pageCount: { $sum: { $cond: [{ $eq: ["$eventType", "pageview"] }, 1, 0] } },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        bounceSessions: {
                            $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] },
                        },
                    },
                },
            ]),

            // Top entry pages
            Analytics.aggregate([
                { $match: { entryPage: { $ne: "" }, createdAt: { $gte: startDate } } },
                { $group: { _id: "$entryPage", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),

            // Top exit pages
            Analytics.aggregate([
                { $match: { eventType: "session_end", createdAt: { $gte: startDate } } },
                { $group: { _id: "$exitPage", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),

            // Daily pageviews for chart
            Analytics.aggregate([
                { $match: { eventType: "pageview", createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            // Average session duration
            Analytics.aggregate([
                { $match: { eventType: "session_end", sessionDuration: { $gt: 0 }, createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: null,
                        avgDuration: { $avg: "$sessionDuration" },
                    },
                },
            ]),

            // Browser breakdown
            Analytics.aggregate([
                { $match: { eventType: "pageview", browser: { $ne: "" }, createdAt: { $gte: startDate } } },
                { $group: { _id: "$browser", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // OS breakdown
            Analytics.aggregate([
                { $match: { eventType: "pageview", os: { $ne: "" }, createdAt: { $gte: startDate } } },
                { $group: { _id: "$os", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // Top button clicks
            Analytics.aggregate([
                { $match: { eventType: "click", createdAt: { $gte: startDate } } },
                { $group: { _id: "$metadata.buttonText", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
        ]);

        const bounceRate =
            bounceData.length > 0 && bounceData[0].totalSessions > 0
                ? ((bounceData[0].bounceSessions / bounceData[0].totalSessions) * 100).toFixed(1)
                : 0;

        const avgDuration =
            avgSessionDuration.length > 0
                ? Math.round(avgSessionDuration[0].avgDuration / 1000) // seconds
                : 0;

        res.json({
            period: `${days} days`,
            totalPageviews,
            uniqueSessions,
            bounceRate: parseFloat(bounceRate),
            avgSessionDurationSeconds: avgDuration,
            pageViewsByPage,
            deviceBreakdown,
            browserBreakdown,
            osBreakdown,
            topEntryPages,
            topExitPages,
            dailyPageviews,
            topButtonClicks,
        });
    } catch (error) {
        console.error("Analytics dashboard error:", error.message);
        res.status(500).json({ message: "Server error fetching analytics" });
    }
};

/**
 * @desc    Get real-time analytics (last 5 minutes)
 * @route   GET /api/analytics/realtime
 * @access  Private/Admin
 */
const getRealtime = async (req, res) => {
    try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

        const activeSessions = await Analytics.distinct("sessionId", {
            createdAt: { $gte: fiveMinAgo },
        });

        const recentEvents = await Analytics.find({
            createdAt: { $gte: fiveMinAgo },
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({
            activeUsers: activeSessions.length,
            recentEvents,
        });
    } catch (error) {
        console.error("Realtime analytics error:", error.message);
        res.status(500).json({ message: "Server error fetching realtime analytics" });
    }
};

module.exports = { trackEvent, trackBatch, getDashboard, getRealtime };
