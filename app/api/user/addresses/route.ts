import { NextRequest, NextResponse } from "next/server";
import { ObjectId, UpdateFilter, Document } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface AddressPayload {
  name?: string;
  phone?: string;
  addressDetail?: string;
  address?: string;
  isDefault?: boolean;
}

// POST: 新增會員地址
export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的 JSON 格式" },
        { status: 400 }
      );
    }

    const { userId, address } = body as { userId?: string; address?: AddressPayload };

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "缺少會員 ID (userId)" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { success: false, message: "缺少地址資訊 (address)" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    let objectId;
    try {
      objectId = new ObjectId(userId);
    } catch {
      // 若非標準 ObjectId 格式，則退回以一般字串查詢（NextAuth 部份 Adapter 支援字串 ID）
    }

    const query = objectId ? { _id: objectId } : { id: userId };
    const user = await db.collection("users").findOne(query);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到該會員" },
        { status: 404 }
      );
    }

    const userAddresses = (user.addresses || []) as unknown[];

    // 數量防禦： 如果 user.addresses 存在且 user.addresses.length >= 3，攔截並回傳 400
    if (userAddresses.length >= 3) {
      return NextResponse.json(
        { success: false, message: "儲存地址已達 3 筆上限" },
        { status: 400 }
      );
    }

    // 首筆預設： 如果通過檢查，且此地址為該會員的第一筆地址，自動將其 isDefault 設為 true
    const isFirstAddress = userAddresses.length === 0;
    const newAddress = {
      id: new ObjectId().toString(), // 產生專屬唯一的地址識別碼
      name: address.name || "",
      phone: address.phone || "",
      addressDetail: address.addressDetail || address.address || "",
      isDefault: isFirstAddress ? true : Boolean(address.isDefault),
    };

    // 若此新地址被設為預設地址，且非首筆，需先將其他所有地址的 isDefault 設為 false
    if (newAddress.isDefault && !isFirstAddress) {
      await db.collection("users").updateOne(
        query,
        {
          $set: { "addresses.$[].isDefault": false }
        }
      );
    }

    // 使用 $push 寫入 addresses 陣列
    const updateResult = await db.collection("users").updateOne(
      query,
      {
        $push: { addresses: newAddress }
      } as unknown as UpdateFilter<Document>
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: "無法寫入地址" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "儲存地址成功",
      data: newAddress,
    });
  } catch (error) {
    console.error("POST addresses API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}

// PUT: 修改會員地址
export async function PUT(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的 JSON 格式" },
        { status: 400 }
      );
    }

    const { userId, addressId, address } = body as { userId?: string; addressId?: string; address?: AddressPayload };

    if (!userId || !addressId || !address) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數 (userId, addressId, address)" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    let objectId;
    try {
      objectId = new ObjectId(userId);
    } catch {}

    const query = objectId ? { _id: objectId } : { id: userId };
    const user = await db.collection("users").findOne(query);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到該會員" },
        { status: 404 }
      );
    }

    interface DBAddress {
      id: string;
      name: string;
      phone: string;
      addressDetail: string;
      isDefault: boolean;
    }

    const addresses = (user.addresses || []) as DBAddress[];
    const addressIndex = addresses.findIndex((addr) => addr.id === addressId);

    if (addressIndex === -1) {
      return NextResponse.json(
        { success: false, message: "找不到該地址紀錄" },
        { status: 404 }
      );
    }

    // 若要把此地址設為預設地址，需先將其他所有地址的 isDefault 設為 false
    const willBeDefault = Boolean(address.isDefault);
    if (willBeDefault) {
      await db.collection("users").updateOne(
        query,
        {
          $set: { "addresses.$[].isDefault": false }
        }
      );
    }

    // 更新特定的地址內容
    const updatedAddress = {
      id: addressId,
      name: address.name !== undefined ? address.name : addresses[addressIndex].name,
      phone: address.phone !== undefined ? address.phone : addresses[addressIndex].phone,
      addressDetail: address.addressDetail !== undefined ? address.addressDetail : (address.address !== undefined ? address.address : addresses[addressIndex].addressDetail),
      isDefault: willBeDefault,
    };

    const updateResult = await db.collection("users").updateOne(
      { ...query, "addresses.id": addressId },
      {
        $set: { "addresses.$": updatedAddress }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: "地址修改失敗" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "修改地址成功",
      data: updatedAddress,
    });
  } catch (error) {
    console.error("PUT addresses API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}

// DELETE: 刪除會員地址
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const addressId = searchParams.get("addressId");

    if (!userId || !addressId) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數 (userId, addressId)" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    let objectId;
    try {
      objectId = new ObjectId(userId);
    } catch {}

    const query = objectId ? { _id: objectId } : { id: userId };

    const updateResult = await db.collection("users").updateOne(
      query,
      {
        $pull: { addresses: { id: addressId } }
      } as unknown as UpdateFilter<Document>
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: "地址刪除失敗或找不到該地址" },
        { status: 500 }
      );
    }

    // 自動把剩餘地址的第一個地址設為預設 (若先前刪除的是預設地址)
    const updatedUser = await db.collection("users").findOne(query);
    if (updatedUser && updatedUser.addresses && updatedUser.addresses.length > 0) {
      interface DBAddress {
        id: string;
        isDefault: boolean;
      }
      const currentAddresses = updatedUser.addresses as DBAddress[];
      const hasDefault = currentAddresses.some((addr) => addr.isDefault);
      if (!hasDefault) {
        await db.collection("users").updateOne(
          { ...query, "addresses.id": currentAddresses[0].id },
          {
            $set: { "addresses.$.isDefault": true }
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "地址刪除成功",
    });
  } catch (error) {
    console.error("DELETE addresses API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
