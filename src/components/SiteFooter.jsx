import { Link } from 'react-router-dom';

/** `auth` is optional; without it the account links are simply left out. */
export default function SiteFooter({ auth } = {}) {
  const user = auth?.user ?? null;
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <div className="foot-col">
          <b>প্রস্তুতি</b>
          <p>
            বাংলাদেশ সরকারি চাকরির ১১–২০ গ্রেড নিয়োগ পরীক্ষার জন্য বিনামূল্যে
            মডেল টেস্ট। বাংলা, ইংরেজি, গণিত ও সাধারণ জ্ঞান — প্রতিটি প্রশ্নের
            ব্যাখ্যাসহ।
          </p>
        </div>

        <div className="foot-col">
          <b>পরীক্ষা</b>
          <Link to="/prepare">প্রস্তুতি কক্ষ</Link>
          {user && <Link to="/profile">প্রোফাইল ও ফলাফল</Link>}
          <Link to="/demo">ডেমো পরীক্ষা</Link>
          <Link to="/start">পূর্ণ মডেল টেস্ট</Link>
          <Link to="/start?mode=topic">বিষয়ভিত্তিক অনুশীলন</Link>
        </div>

        <div className="foot-col">
          <b>তথ্য</b>
          <span>প্রশ্নব্যাংক নিয়মিত হালনাগাদ হয়</span>
          <span>প্রতিটি প্রশ্ন যাচাই করে যুক্ত করা হয়</span>
          <span>যোগাযোগ: abdulkader.69k@gmail.com</span>
        </div>
      </div>

      <div className="foot-base">
        <span>© {new Date().getFullYear()} প্রস্তুতি</span>
        <span>
          পুরোনো প্রশ্নের ধাঁচে তৈরি — কোনো সরকারি সংস্থার সঙ্গে সম্পৃক্ত নয়।
        </span>
      </div>
    </footer>
  );
}
