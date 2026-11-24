/**
 * /bot: what BulkSkartDiscoveryBot is, what it reads and how to stop it. Linked from the crawler's User-Agent.
 */
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';

export default function CrawlerInfoPage() {
  return (
    <MainLayout>
      <PageMeta title="BulkSkartDiscoveryBot | BulkSkart" description="What BulkSkart's website reader collects, how it behaves and how to opt out." />
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-[15px] leading-relaxed">
        <h1 className="text-2xl font-black">BulkSkartDiscoveryBot</h1>
        <p>
          BulkSkart reads the public websites of manufacturers to list them and their products in its <Link to="/directory" className="font-bold underline">Supplier Directory</Link>.
          Its requests carry the User-Agent <code>BulkSkartDiscoveryBot/1.0 (+https://www.bulkskart.com/bot)</code>.
        </p>
        <h2 className="text-lg font-black">What it reads</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your home, about and contact pages, and your product pages, up to a small number of pages per visit.</li>
          <li>Only what those pages publish: company name, GSTIN, address, product names, descriptions and specifications.</li>
          <li>A company is listed only after its GST registration is confirmed active by an authorised check. Phone numbers and emails are never shown publicly.</li>
        </ul>
        <h2 className="text-lg font-black">How it behaves</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>It follows <code>robots.txt</code>, including <code>Crawl-delay</code>, and waits at least 1.5 seconds between requests to a site.</li>
          <li>It revisits about once a month to check the pages still exist, and removes listings whose pages are gone.</li>
        </ul>
        <h2 className="text-lg font-black">Opting out</h2>
        <p>Add this to your <code>robots.txt</code>:</p>
        <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-[13px]">{'User-agent: BulkSkartDiscoveryBot\nDisallow: /'}</pre>
        <p>
          To have an existing listing removed, <Link to="/contact?subject=Directory%20removal" className="font-bold underline">contact us</Link>. Removed
          companies are not collected again.
        </p>
      </article>
    </MainLayout>
  );
}
