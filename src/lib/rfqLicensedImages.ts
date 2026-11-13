/**
 * Reviewed licensed photos for active buying requirements (checked by eye against each requirement).
 * A value of null means no exact licensed photo was found yet: the card shows the neutral placeholder
 * instead of the earlier AI-generated image. Sources and licences are kept for audit.
 */
export interface RfqLicensedImage { url: string; source: string; license: string; creator: string | null }

export const RFQ_LICENSED_IMAGES: Record<string, RfqLicensedImage | null> = {
  "99810000-0000-0000-0000-000000009981": null,
  "10420000-0000-0000-0000-000000001042": { url: "https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg", source: "https://www.flickr.com/photos/10361931@N06/5009413427", license: "by", creator: "Horia Varlan" },
  "88720000-0000-0000-0000-000000008872": null,
  "c0000001-0000-0000-0000-000000000001": { url: "https://live.staticflickr.com/65535/51549857553_d4a091ba6b_b.jpg", source: "https://www.flickr.com/photos/60295192@N08/51549857553", license: "by-sa", creator: "Fairphone" },
  "c0000001-0000-0000-0000-000000000002": { url: "https://live.staticflickr.com/3308/3414028795_d2083e0388_b.jpg", source: "https://www.flickr.com/photos/52645928@N00/3414028795", license: "by-sa", creator: "spanginator" },
  "c0000001-0000-0000-0000-000000000003": null,
  "c0000001-0000-0000-0000-000000000004": null,
  "c0000001-0000-0000-0000-000000000007": null,
  "c0000001-0000-0000-0000-000000000006": null,
  "c0000001-0000-0000-0000-000000000005": null,
  "c0000001-0000-0000-0000-000000000010": null,
  "c0000001-0000-0000-0000-000000000008": { url: "https://live.staticflickr.com/1312/1425690749_812403b0e1.jpg", source: "https://www.flickr.com/photos/43109416@N00/1425690749", license: "by", creator: "nevil zaveri (thank you for 20+M views:)" },
  "c0000001-0000-0000-0000-000000000009": null,
  "c0000001-0000-0000-0000-000000000011": null,
  "c0000001-0000-0000-0000-000000000012": null,
  "c0000001-0000-0000-0000-000000000013": { url: "https://live.staticflickr.com/2378/2126854349_1267f1bcd9_b.jpg", source: "https://www.flickr.com/photos/21578016@N08/2126854349", license: "by", creator: "dalazzarato" },
  "c0000001-0000-0000-0000-000000000015": { url: "https://live.staticflickr.com/2515/4114405563_d985f8be3e_b.jpg", source: "https://www.flickr.com/photos/10978010@N07/4114405563", license: "by-sa", creator: "londoncyclist" },
  "c0000001-0000-0000-0000-000000000014": null,
  "c0000001-0000-0000-0000-000000000016": { url: "https://live.staticflickr.com/7193/13467833314_5f09861088_b.jpg", source: "https://www.flickr.com/photos/65265630@N03/13467833314", license: "by", creator: "Janitors" },
};
