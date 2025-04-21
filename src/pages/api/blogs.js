import { getSlug, getBlogFromSlug } from '@/utils/mdx';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const slugs = await getSlug();
        const blogs = await Promise.all(
            slugs.map(async (slug) => {
                try {
                    const { frontmatter } = await getBlogFromSlug(slug);
                    return {
                        slug,
                        title: frontmatter.title,
                        publishedAt: frontmatter.publishedAt,
                    };
                } catch (error) {
                    console.error(`Error processing blog ${slug}:`, error);
                    return null;
                }
            })
        );

        // Filter out any null entries and sort blogs by date
        const validBlogs = blogs.filter(blog => blog !== null);
        validBlogs.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        // Set proper headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

        return res.status(200).json(validBlogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch blogs',
            message: error.message 
        });
    }
} 